-- Exact row counts and content fingerprints. No private row payload leaves DB.
CREATE TEMP TABLE preservation (schema_name text, table_name text, rows bigint, fingerprint text);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('nfl','nhl') LOOP
  EXECUTE format('INSERT INTO preservation SELECT %L,%L,count(*), md5(coalesce(string_agg(row_hash, '''' ORDER BY row_hash),'''')) FROM (SELECT md5(to_jsonb(r)::text) row_hash FROM %I.%I r) x', t.schemaname,t.tablename,t.schemaname,t.tablename);
 END LOOP;
END $$;
SELECT jsonb_agg(to_jsonb(p) ORDER BY schema_name,table_name) AS preservation FROM preservation p;
DROP TABLE preservation;
