"""Portable relational catalog; canonical IDs, cutoff columns, JSON details."""
import json
from sqlalchemy import (MetaData, Table, Column, String, Integer, Float, JSON,
                        ForeignKey, Index, create_engine, select, delete, event)
from .config import DATABASE_URL

metadata = MetaData()
tables = {}

def table(name, *columns):
    t = Table(name, metadata, *columns)
    tables[name] = t
    return t

table('teams', Column('team_id', String, primary_key=True), Column('payload', JSON, nullable=False))
table('players', Column('player_id', String, primary_key=True), Column('payload', JSON, nullable=False))
table('games', Column('game_id', String, primary_key=True), Column('season', Integer, index=True),
      Column('start_time', String, index=True), Column('completed_at', String),
      Column('home_team_id', String, ForeignKey('teams.team_id')), Column('away_team_id', String, ForeignKey('teams.team_id')),
      Column('status', String), Column('payload', JSON, nullable=False))
table('source_game_mappings', Column('source', String, primary_key=True), Column('external_id', String, primary_key=True),
      Column('game_id', String, ForeignKey('games.game_id')), Column('payload', JSON, nullable=False))
for name in ('raw_nba_payloads','raw_injury_reports','raw_market_payloads'):
    table(name, Column('id', String, primary_key=True), Column('payload_hash', String, index=True),
          Column('source', String), Column('endpoint', String), Column('requested_at', String, index=True),
          Column('payload', JSON, nullable=False))
for name in ('player_game_stats','team_game_stats','rotation_stints','lineup_stints','injury_snapshots','lineup_snapshots',
             'market_snapshots','projected_minutes','pregame_availability','pregame_features',
             'pregame_predictions','halftime_features','halftime_predictions','quality_issues'):
    table(name, Column('id', String, primary_key=True), Column('game_id', String, ForeignKey('games.game_id'), index=True),
          Column('player_id', String, index=True), Column('team_id', String, index=True),
          Column('captured_at', String, index=True), Column('as_of_date', String, index=True),
          Column('payload', JSON, nullable=False))
for name in ('player_ratings','team_ratings'):
    table(name, Column('id', String, primary_key=True), Column('entity_id', String, index=True),
          Column('as_of_date', String, index=True), Column('payload', JSON, nullable=False))

def engine(url=DATABASE_URL):
    e = create_engine(url)
    if e.dialect.name == 'sqlite':
        @event.listens_for(e, 'connect')
        def foreign_keys(conn, _):
            conn.execute('PRAGMA foreign_keys=ON')
            conn.execute('PRAGMA busy_timeout=60000')
    return e

def put(conn, name, row, immutable=False):
    t = tables[name]
    key = [t.c[c.name] == row[c.name] for c in t.primary_key]
    old = conn.execute(select(t).where(*key)).mappings().first()
    if old is not None:
        if immutable:
            if dict(old) != row:
                raise ValueError(f'Attempt to change immutable {name}')
            return
        conn.execute(t.update().where(*key).values(**row))
    else:
        conn.execute(t.insert().values(**row))

def rows(conn, name):
    return [dict(r) for r in conn.execute(select(tables[name])).mappings()]


def game_index(conn, scores=False):
    """Stream bulky event payloads and retain only fields needed for crosswalks."""
    result=[]
    table=tables['games']
    query=select(table) if scores else select(*[c for c in table.c if c.name!='payload'])
    for r in conn.execute(query).mappings():
        item={k:v for k,v in r.items() if k!='payload'}
        if scores:
            item['payload']={k:r['payload'][k] for k in ('home_score','away_score')}
        result.append(item)
    return result

def derived(conn, name, key, payload, game_id=None, team_id=None, player_id=None,
            captured_at=None, as_of_date=None):
    put(conn, name, dict(id=key, game_id=game_id, team_id=team_id, player_id=player_id,
        captured_at=captured_at, as_of_date=as_of_date, payload=json.loads(json.dumps(payload, allow_nan=False))),
        immutable=name in ('injury_snapshots','market_snapshots','lineup_snapshots'))
