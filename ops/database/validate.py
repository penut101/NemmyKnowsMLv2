"""Verify catalog signatures and actual browser-role authorization without writes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re

import psycopg
from psycopg import sql
from setup import MANIFEST, check_target

HERE = Path(__file__).resolve().parent
SCHEMAS = ('mlb', 'cfb', 'nfl', 'nhl', 'nba')


def signatures(inventory):
    result = {}
    for schema in SCHEMAS:
        result[schema] = {}
        for section in ('tables', 'columns', 'constraints', 'indexes', 'functions', 'triggers', 'policies'):
            rows = [r for r in inventory[section] or []
                    if (r.get('schema') or r.get('schemaname') or r.get('table_schema')) == schema]
            # pg_get_functiondef preserves source newline style.
            normalized = json.loads(json.dumps(rows))
            for row in normalized:
                if 'definition' in row:
                    row['definition'] = re.sub(r'\s+', ' ', row['definition']).strip()
            result[schema][section] = {
                'count': len(rows),
                'sha256': hashlib.sha256(json.dumps(normalized, sort_keys=True).encode()).hexdigest(),
            }
    return result


def verify(conn):
    inventory = conn.execute((HERE/'inventory.sql').read_text()).fetchone()[0]
    expected = json.loads((HERE/'expected.json').read_text())
    actual = signatures(inventory)
    for schema in SCHEMAS:
        for section in expected[schema]:
            if actual[schema][section] != expected[schema][section]:
                raise AssertionError(f'Catalog drift: {schema}.{section}')
    for function in inventory['functions']:
        assert function['config'] and any(v.startswith('search_path=') for v in function['config']), function['name']
        if function['definer']:
            assert not function['anon_execute'], function['name']
    tested = 0
    for role in ('anon','authenticated'):
        for table in inventory['tables']:
            schema, name = table['schema'], table['name']
            target = sql.Identifier(schema, name)
            assert table['rls'], (schema, name, 'RLS missing')
            for privilege in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'):
                allowed = conn.execute('SELECT has_table_privilege(%s,%s,%s)', (role,f'{schema}.{name}',privilege)).fetchone()[0]
                assert not allowed, (role,schema,name,privilege)
            public = name in MANIFEST['public_tables'][schema]
            readable = conn.execute('SELECT has_schema_privilege(%s,%s,\'USAGE\') AND has_table_privilege(%s,%s,\'SELECT\')', (role,schema,role,f'{schema}.{name}')).fetchone()[0]
            # Each probe rolls back even if a future regression permits a write.
            for operation in ('read', 'insert'):
                conn.execute('SAVEPOINT authorization_probe')
                try:
                    conn.execute(sql.SQL('SET LOCAL ROLE {}').format(sql.Identifier(role)))
                    if operation == 'read':
                        rows = conn.execute(sql.SQL('SELECT * FROM {} LIMIT 1').format(target)).fetchall()
                        assert public or not rows, (role,schema,name,'private rows visible')
                    else:
                        conn.execute(sql.SQL('INSERT INTO {} DEFAULT VALUES').format(target))
                        raise AssertionError((role,schema,name,'write succeeded'))
                except psycopg.errors.InsufficientPrivilege:
                    assert operation == 'insert' or not public, (role,schema,name,'public read denied')
                finally:
                    conn.execute('ROLLBACK TO SAVEPOINT authorization_probe')
                    conn.execute('RELEASE SAVEPOINT authorization_probe')
                tested += 1
            if public:
                assert readable, (role,schema,name,'missing grant')
    print(f'Catalog, RLS, grants, functions and {tested} role probes passed')
    return inventory


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--local', action='store_true')
    p.add_argument('--project-ref')
    args = p.parse_args()
    url = os.environ['DATABASE_URL']
    check_target(url, args.local, args.project_ref)
    with psycopg.connect(url) as conn:
        verify(conn)
        conn.rollback()


if __name__ == '__main__':
    main()
