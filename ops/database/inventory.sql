SELECT jsonb_build_object(
 'tables', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema,t.name) FROM (
   SELECT n.nspname AS schema, c.relname AS name, c.relrowsecurity AS rls
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('mlb','cfb','nfl','nhl','nba') AND c.relkind='r') t),
 'columns', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.table_schema,t.table_name,t.ordinal_position)
   FROM (SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default
     FROM information_schema.columns WHERE table_schema IN ('mlb','cfb','nfl','nhl','nba')) t),
 'constraints', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema,t.table_name,t.name) FROM (
   SELECT n.nspname AS schema,c.relname AS table_name,con.conname AS name,pg_get_constraintdef(con.oid) AS definition
   FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('mlb','cfb','nfl','nhl','nba')) t),
 'indexes', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schemaname,t.indexname) FROM (
   SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('mlb','cfb','nfl','nhl','nba')) t),
 'functions', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema,t.name,t.args) FROM (
   SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,
     p.proconfig AS config,p.prosecdef AS definer,pg_get_functiondef(p.oid) AS definition,
     has_function_privilege('anon',p.oid,'execute') AS anon_execute
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('mlb','cfb','nfl','nhl','nba') OR p.proname='site_revalidate') t),
 'triggers', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema,t.table_name,t.name) FROM (
   SELECT n.nspname AS schema,c.relname AS table_name,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE NOT t.tgisinternal AND n.nspname IN ('mlb','cfb','nfl','nhl','nba')) t),
 'policies', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schemaname,t.tablename,t.policyname) FROM (
   SELECT * FROM pg_policies WHERE schemaname IN ('mlb','cfb','nfl','nhl','nba')) t),
 'grants', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.table_schema,t.table_name,t.grantee,t.privilege_type) FROM (
   SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.table_privileges
   WHERE table_schema IN ('mlb','cfb','nfl','nhl','nba') AND grantee IN ('anon','authenticated','PUBLIC','service_role')) t)
) AS inventory;
