"""Content-addressed raw bytes with append-only observation receipts."""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from .config import DATA

def utcnow():
    return datetime.now(timezone.utc).isoformat()

class RawStore:
    def __init__(self, root=DATA):
        self.root = Path(root)
        (self.root / 'raw/objects').mkdir(parents=True, exist_ok=True)
        (self.root / 'raw/receipts').mkdir(parents=True, exist_ok=True)

    def put(self, content, source, endpoint, status=200, available_at=None):
        digest = hashlib.sha256(content).hexdigest()
        path = self.root / 'raw/objects' / digest
        try:
            with path.open('xb') as f:
                f.write(content)
        except FileExistsError:
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise ValueError('Corrupt immutable object')
        record = dict(source=source, endpoint=endpoint, requested_at=utcnow(),
                      available_at=available_at, payload_hash=digest, status=status, bytes=len(content))
        rid = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
        with (self.root / 'raw/receipts' / (rid + '.json')).open('x') as f:
            json.dump(record, f, sort_keys=True)
        return path, record

class Client:
    def __init__(self, store=None, pause=None):
        self.store = store or RawStore()
        self.pause = float(os.getenv('NBA_REQUEST_PAUSE', '.75')) if pause is None else pause
        self.session = requests.Session()
        self.session.headers.update({'User-Agent':'NemmyKnowsMLv2 NBA research', 'Referer':'https://www.nba.com/'})
        self.session.mount('https://', HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1,
            status_forcelist=[429,500,502,503,504], allowed_methods=['GET'])))

    def get(self, url, source, immutable=False):
        cache = self.store.root / 'raw/cache'
        cache.mkdir(parents=True, exist_ok=True)
        key = cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if immutable and key.exists():
            record = json.loads(key.read_text())
            path = self.store.root / 'raw/objects' / record['payload_hash']
            if hashlib.sha256(path.read_bytes()).hexdigest() != record['payload_hash']:
                raise ValueError('Cached object hash mismatch')
            return path, record
        time.sleep(self.pause)
        response = self.session.get(url, timeout=(15,90))
        path, record = self.store.put(response.content, source, url, response.status_code)
        response.raise_for_status()
        if immutable:
            key.write_text(json.dumps(record))
        print(json.dumps({'event':'fetch', **record}), flush=True)
        return path, record
