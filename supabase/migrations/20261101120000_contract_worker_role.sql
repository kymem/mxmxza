-- Run only after the frontend that writes 'worker' is deployed and verified.
-- Converts legacy 'service_provider' rows to 'worker' and removes the legacy value
-- from constraints, policies and functions. RPC and table names are unchanged.

begin;

create or replace function pg_temp.remove_legacy_role(t text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(t, ',\s*''service_provider''(::text)?', '', 'g'),
             '''service_provider''(::text)?\s*,\s*', '', 'g'),
           '''service_provider''(::text)?', '''worker''', 'g')
$$;

update public.user_profiles set role = 'worker' where role = 'service_provider';
update public.task_messages set sender_role = 'worker' where sender_role = 'service_provider';

do $$
declare
  c record;
  p record;
  f record;
  new_def text;
begin
  for c in
    select con.conname, cls.relname, con.oid
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace ns on ns.oid = cls.relnamespace
     where ns.nspname = 'public'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%''service_provider''%'
  loop
    new_def := pg_temp.remove_legacy_role(pg_get_constraintdef(c.oid));
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
    execute format('alter table public.%I add constraint %I %s', c.relname, c.conname, new_def);
  end loop;

  for p in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') like '%''service_provider''%'
            or coalesce(with_check, '') like '%''service_provider''%')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format(
      'create policy %I on %I.%I as %s for %s to %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      array_to_string(p.roles, ', '),
      case when p.qual is not null then ' using (' || pg_temp.remove_legacy_role(p.qual) || ')' else '' end,
      case when p.with_check is not null then ' with check (' || pg_temp.remove_legacy_role(p.with_check) || ')' else '' end
    );
  end loop;

  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and pg_get_functiondef(p.oid) like '%''service_provider''%'
  loop
    execute pg_temp.remove_legacy_role(f.def);
  end loop;
end $$;

do $$
begin
  if exists (select 1 from public.user_profiles where role = 'service_provider')
     or exists (select 1 from public.task_messages where sender_role = 'service_provider')
     or exists (
       select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
        where ns.nspname = 'public' and pg_get_functiondef(p.oid) like '%''service_provider''%')
     or exists (
       select 1 from pg_policies
        where schemaname = 'public'
          and (coalesce(qual, '') like '%''service_provider''%'
               or coalesce(with_check, '') like '%''service_provider''%'))
     or exists (
       select 1 from pg_constraint con
        where con.contype = 'c' and pg_get_constraintdef(con.oid) like '%''service_provider''%')
  then
    raise exception 'Legacy service_provider role still present after contract migration';
  end if;
end $$;

commit;
