"""Exercise the public PostgREST contract, without printing API keys or rows."""
import argparse
import json
import os
from pathlib import Path
import requests
from setup import MANIFEST


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--credentials-file', type=Path, help='Ignored JSON containing url and public key')
    args = p.parse_args()
    config = json.loads(args.credentials_file.read_text()) if args.credentials_file else {
        'url': os.environ['NEXT_PUBLIC_SUPABASE_URL'],
        'key': os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    }
    url = config['url'].rstrip('/')
    assert url == f"https://{MANIFEST['project_ref']}.supabase.co", 'Wrong project'
    headers = {'apikey': config['key']}
    count = 0
    for sport, tables in MANIFEST['public_tables'].items():
        for table in tables:
            r = requests.get(f'{url}/rest/v1/{table}', headers={**headers,'Accept-Profile':sport}, params={'select':'*','limit':1}, timeout=30)
            assert r.status_code == 200, (sport,table,r.status_code)
            count += 1
        if tables:
            r = requests.post(f'{url}/rest/v1/{tables[0]}', headers={**headers,'Content-Profile':sport}, json={}, timeout=30)
            assert r.status_code in (401,403), (sport,'browser insert',r.status_code)
    for sport, table in [('mlb','player_value_models'),('cfb','qb_availability'),('nba','teams')]:
        r = requests.get(f'{url}/rest/v1/{table}', headers={**headers,'Accept-Profile':sport}, params={'limit':1}, timeout=30)
        assert r.status_code in (401,403,404,406), (sport,table,r.status_code)
    for sport, rpc in [('mlb','betting_headline'),('mlb','bet_record_summary'),('cfb','recommendation_summary')]:
        r = requests.get(f'{url}/rest/v1/rpc/{rpc}', headers={**headers,'Accept-Profile':sport}, timeout=30)
        assert r.status_code == 200, (sport,rpc,r.status_code)
    print(f'{count} public table reads, 3 RPCs, 4 rejected writes and 3 private-access denials passed')


if __name__ == '__main__':
    main()
