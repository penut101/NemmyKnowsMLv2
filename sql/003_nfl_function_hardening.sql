-- Apply after the NFL model migrations.
alter function nfl.reject_recommendation_truncate() set search_path = pg_catalog;
alter function nfl.check_recommendation_commit() set search_path = pg_catalog;
