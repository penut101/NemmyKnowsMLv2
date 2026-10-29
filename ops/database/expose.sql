-- Apply only after migration and authorization validation. Preserve other
-- intentionally exposed schemas; NBA remains private and must not be listed.
DO $$ DECLARE existing text; exposed text; BEGIN
 SELECT split_part(setting,'=',2) INTO existing FROM pg_roles,
   unnest(rolconfig) setting WHERE rolname='authenticator' AND setting LIKE 'pgrst.db_schemas=%';
 IF existing IS NULL THEN
   RAISE EXCEPTION 'Inspect Data API config first: authenticator has no db_schemas override';
 END IF;
 SELECT string_agg(name, ', ' ORDER BY name) INTO exposed FROM (
   SELECT DISTINCT trim(name) name FROM unnest(string_to_array(existing,',') || ARRAY['mlb','cfb','nfl','nhl']) name
 ) names WHERE name <> '' AND name <> 'nba';
 EXECUTE format('ALTER ROLE authenticator SET pgrst.db_schemas = %L', exposed);
END $$;
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
