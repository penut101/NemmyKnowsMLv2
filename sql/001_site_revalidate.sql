-- Requires Supabase pg_net and Vault; provision site_revalidate_secret separately.
CREATE OR REPLACE FUNCTION public.site_revalidate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_url text;
begin
  select decrypted_secret into target_url from vault.decrypted_secrets
    where name = 'site_revalidate_url';
  if target_url is null or target_url = '' then
    return null;
  end if;
  perform net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-revalidate-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'site_revalidate_secret')
    ),
    body := jsonb_build_object('schema', tg_table_schema, 'table', tg_table_name),
    timeout_milliseconds := 5000
  );
  return null;
end
$function$
;
REVOKE ALL ON FUNCTION public.site_revalidate() FROM PUBLIC;
