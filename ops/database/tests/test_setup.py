import copy
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from setup import MANIFEST, ROOT, check_target, chain, sql_source
from bootstrap_mlb import normalize


def test_target_guard():
    ref = MANIFEST['project_ref']
    check_target(f'postgresql://postgres@db.{ref}.supabase.co/postgres', False, ref)
    check_target(f'postgresql://postgres.{ref}@aws-0-us-east-2.pooler.supabase.com/postgres', False, ref)
    check_target('postgresql://postgres@127.0.0.1/postgres', True, None)
    for url, local, target in [
        ('postgresql://postgres@db.some-other-project.supabase.co/postgres',False,ref),
        ('postgresql://postgres.some-other-project@aws-0-us-east-2.pooler.supabase.com/postgres',False,ref),
        (f'postgresql://postgres@db.{ref}.supabase.co/postgres',True,None),
        (f'postgresql://postgres@db.{ref}.supabase.co/postgres',False,None),
    ]:
        with pytest.raises(ValueError):
            check_target(url,local,target)


def test_manifest_covers_post_baseline_releases():
    for sport, folder in [('mlb','models/mlb/backend/sql'),('cfb','models/cfb/sql')]:
        files = set(chain(sport))
        for path in (ROOT/folder).glob('2026*.sql'):
            assert path.relative_to(ROOT).as_posix() in files
        assert len(files) == len(chain(sport))
        for path in files:
            source = sql_source(path)
            assert '\\restrict' not in source and '\\unrestrict' not in source
    assert 'models/mlb/backend/sql/playoff_forecast_stages.sql' not in chain('mlb')
    assert 'models/cfb/sql/019_recommendation_published_total.sql' not in chain('cfb')


def fixture():
    return dict(gamePk=1,gameType='R',gameDate='2026-04-02T20:00:00Z',officialDate='2026-04-03',
                status={'abstractGameState':'Final','detailedState':'Final'},
                teams={'home':{'team':{'abbreviation':'BOS'},'score':3},
                       'away':{'team':{'abbreviation':'NYY'},'score':2}})


def test_rescheduled_listing_uses_explicit_provider_cross_reference():
    old = fixture()
    old['status']['detailedState'] = 'Postponed'
    old['rescheduleDate'] = '2026-04-03T20:00:00Z'
    new = fixture()
    new.update(gameDate=old['rescheduleDate'],rescheduledFrom=old['gameDate'])
    rows = normalize({'dates':[{'date':'2026-04-02','games':[old]}, {'date':'2026-04-03','games':[new]}]})
    assert len(rows) == 1
    assert rows[0]['start_time'] == new['gameDate']
    assert rows[0]['game_date'] == new['officialDate']
    assert rows[0]['status'] == 'Final'


def test_resume_preserves_original_start_and_conflicts_fail():
    original = fixture()
    resumed = copy.deepcopy(original)
    resumed.update(resumedFrom=original['gameDate'],gameDate='2026-04-03T20:00:00Z')
    data = {'dates':[{'date':'2026-04-03','games':[original,resumed]}]}
    assert normalize(data)[0]['start_time'] == original['gameDate']
    resumed['teams']['home']['score'] = 4
    with pytest.raises(ValueError,match='Conflicting source observations'):
        normalize(data)
