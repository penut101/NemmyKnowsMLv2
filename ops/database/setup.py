"""Explicit, checksum-tracked orchestration of existing sport migration systems.

Never accepts a database URL on the command line or prints credentials.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlsplit

import psycopg

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((Path(__file__).with_name('manifest.json')).read_text())


def check_target(url, local, project_ref):
    parsed = urlsplit(url.replace('postgresql+psycopg:', 'postgresql:'))
    if local:
        if parsed.hostname not in ('localhost', '127.0.0.1', '::1'):
            raise ValueError('--local requires a loopback database')
    else:
        ref = MANIFEST['project_ref']
        direct = parsed.hostname == f'db.{ref}.supabase.co'
        pooler = (parsed.hostname or '').endswith('.pooler.supabase.com') and parsed.username == f'postgres.{ref}'
        if project_ref != ref or not (direct or pooler):
            raise ValueError('Production URL and --project-ref must identify the allowed project')


def chain(sport):
    if sport in MANIFEST['chains']:
        return MANIFEST['chains'][sport]
    return [str(p.relative_to(ROOT)).replace('\\', '/')
            for p in sorted((ROOT / 'models' / sport / 'sql').glob('*.sql'))]


def sql_source(path):
    source = (ROOT / path).read_text(encoding='utf-8')
    # pg_dump's psql-only guards are not SQL. Preserve all schema statements.
    source = re.sub(r'^\\(?:un)?restrict .*$', '', source, flags=re.M)
    # Own the transaction so a failure cannot leave a half-installed sport.
    source = re.sub(r'^\s*(?:BEGIN|COMMIT);\s*$', '', source, flags=re.M | re.I)
    # Empty-database install only. Existing busy databases retain upstream's
    # concurrent-index migration; this runner refuses unmanaged schemas.
    source = source.replace('INDEX CONCURRENTLY', 'INDEX')
    return source


def security_sql(sport):
    public = MANIFEST['public_tables'].get(sport) if sport in ('mlb','cfb','nba') else None
    statements = [f'REVOKE CREATE ON SCHEMA {sport} FROM PUBLIC, anon, authenticated;',
                  f'REVOKE ALL ON ALL SEQUENCES IN SCHEMA {sport} FROM PUBLIC, anon, authenticated;',
                  f'ALTER DEFAULT PRIVILEGES IN SCHEMA {sport} REVOKE ALL ON TABLES FROM anon, authenticated;',
                  f'ALTER DEFAULT PRIVILEGES IN SCHEMA {sport} REVOKE ALL ON SEQUENCES FROM anon, authenticated;',
                  f'ALTER DEFAULT PRIVILEGES IN SCHEMA {sport} REVOKE ALL ON FUNCTIONS FROM anon, authenticated;']
    if public is not None:
        statements.append(f'REVOKE ALL ON ALL TABLES IN SCHEMA {sport} FROM PUBLIC, anon, authenticated;')
        if public:
            statements.append(f'GRANT USAGE ON SCHEMA {sport} TO anon, authenticated, service_role;')
            statements.append('GRANT SELECT ON ' + ', '.join(f'{sport}.{t}' for t in public) + ' TO anon, authenticated;')
        statements.append(f"""DO $$ DECLARE t record; BEGIN
          FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='{sport}' LOOP
            EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', '{sport}', t.tablename);
          END LOOP;
        END $$;""")
    if sport == 'mlb':
        statements.extend([
            'GRANT SELECT ON mlb.bet_ledger_v, mlb.bet_ledger_agg_v, mlb.model_outputs_season_unified TO anon, authenticated;',
            'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mlb FROM PUBLIC, anon, authenticated;',
            'GRANT EXECUTE ON FUNCTION mlb.bet_record_summary(text,text,text), mlb.betting_headline() TO anon, authenticated, service_role;',
            'ALTER FUNCTION mlb.set_updated_at_model_outputs_season() SET search_path=pg_catalog;',
        ])
    if sport == 'cfb':
        statements.append('GRANT SELECT ON cfb.recommendation_performance, cfb.current_recommendations TO anon, authenticated;')
        statements.append('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cfb FROM PUBLIC, anon, authenticated;')
        statements.append('GRANT EXECUTE ON FUNCTION cfb.recommendation_summary(integer,text,timestamptz) TO anon, authenticated, service_role;')
    # Trigger functions are not browser RPCs. This preserves table/query behavior.
    statements.append(f"""DO $$ DECLARE f record; BEGIN
      FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='{sport}' AND p.prorettype='trigger'::regtype LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
      END LOOP;
    END $$;""")
    return '\n'.join(statements)


def install(conn, sport):
    paths = chain(sport)
    installed = dict(conn.execute('SELECT path, sha256 FROM platform_setup.migrations WHERE sport=%s', (sport,)).fetchall())
    if not installed and conn.execute('SELECT EXISTS (SELECT FROM pg_namespace WHERE nspname=%s)', (sport,)).fetchone()[0]:
        from validate import signatures
        expected = json.loads((Path(__file__).with_name('expected.json')).read_text())
        inventory = conn.execute(Path(__file__).with_name('inventory.sql').read_text()).fetchone()[0]
        if signatures(inventory)[sport] != expected[sport]:
            raise ValueError(f'{sport} exists without this ledger and differs from the audited catalog; refusing baseline replay')
        print(f'Preserved {sport}: existing catalog matches the complete audited contract')
        return
    for path in paths:
        checksum = hashlib.sha256((ROOT / path).read_text(encoding='utf-8').encode()).hexdigest()
        if path in installed:
            if installed[path] != checksum:
                raise ValueError(f'Applied migration changed: {path}')
            continue
        conn.execute(sql_source(path))
        conn.execute('INSERT INTO platform_setup.migrations VALUES (%s,%s,%s,now())', (sport, path, checksum))
        print(f'Applied {path}')
    conn.execute(security_sql(sport))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--local', action='store_true')
    parser.add_argument('--project-ref')
    parser.add_argument('--sports', nargs='+', choices=['mlb','cfb','nfl','nhl','nba'], default=['mlb','cfb','nfl','nhl','nba'])
    parser.add_argument('--plan', action='store_true')
    args = parser.parse_args()
    if args.plan:
        for sport in args.sports:
            print(sport, 'Alembic HEAD' if sport == 'nba' else '\n  '.join(chain(sport)))
        return
    url = os.environ['DATABASE_URL']
    check_target(url, args.local, args.project_ref)
    with psycopg.connect(url) as conn:
        if int(conn.execute('SHOW server_version_num').fetchone()[0]) // 10000 != 17:
            raise ValueError('PostgreSQL 17 required')
        conn.execute('SELECT pg_advisory_xact_lock(20261028, 1)')
        if args.local:
            conn.execute("""DO $$ BEGIN
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
              IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
            END $$""")
            conn.execute("""CREATE OR REPLACE FUNCTION public.site_revalidate() RETURNS trigger
              LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RETURN NULL; END $$;
              REVOKE ALL ON FUNCTION public.site_revalidate() FROM PUBLIC, anon, authenticated;""")
        else:
            conn.execute('CREATE EXTENSION IF NOT EXISTS pg_net')
            conn.execute('CREATE EXTENSION IF NOT EXISTS supabase_vault')
            conn.execute(sql_source('sql/001_site_revalidate.sql'))
        conn.execute('CREATE SCHEMA IF NOT EXISTS platform_setup; REVOKE ALL ON SCHEMA platform_setup FROM PUBLIC, anon, authenticated')
        conn.execute('CREATE TABLE IF NOT EXISTS platform_setup.migrations (sport text NOT NULL, path text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL)')
        conn.execute('ALTER TABLE platform_setup.migrations ENABLE ROW LEVEL SECURITY')
        for sport in args.sports:
            if sport != 'nba':
                install(conn, sport)
                if sport in ('nfl','nhl'):
                    conn.execute(sql_source(f'sql/00{3 if sport == "nfl" else 2}_{sport}_function_hardening.sql'))
    if 'nba' in args.sports:
        nba_url = url.replace('postgresql://', 'postgresql+psycopg://', 1)
        subprocess.run([sys.executable, '-m', 'src.cli', 'migrate'], cwd=ROOT/'models/nba',
                       env={**os.environ, 'NBA_DATABASE_URL': nba_url}, check=True)
    print('Schema installation finished. Run validate.py; configure intentional Data API exposure separately.')


if __name__ == '__main__':
    main()
