-- Run this entire file once in Supabase > SQL Editor > New query.
-- Safe to run again. Profile data is private; only the Render server has access.
begin;

create table if not exists public.dmc_device_profiles (
  id text primary key,
  token_hash text unique not null,
  body jsonb not null
);
create table if not exists public.dmc_profile_events (
  profile text not null references public.dmc_device_profiles(id) on delete cascade,
  event text not null,
  primary key (profile, event)
);
create table if not exists public.dmc_profile_rounds (
  profile text not null references public.dmc_device_profiles(id) on delete cascade,
  game text not null,
  round integer not null,
  primary key (profile, game, round)
);

alter table public.dmc_device_profiles enable row level security;
alter table public.dmc_profile_events enable row level security;
alter table public.dmc_profile_rounds enable row level security;
revoke all on public.dmc_device_profiles, public.dmc_profile_events, public.dmc_profile_rounds from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.dmc_device_profiles, public.dmc_profile_events, public.dmc_profile_rounds to service_role;

create or replace function public.dmc_profile_save(p_token_hash text, p_profile jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  insert into public.dmc_device_profiles(id, token_hash, body)
  values (p_profile->>'id', p_token_hash, p_profile)
  on conflict (token_hash) do update set body = public.dmc_device_profiles.body ||
    jsonb_build_object('name', excluded.body->'name', 'avatar', excluded.body->'avatar')
  returning body into result;
  return result;
end;
$$;

-- Import any profiles that still exist on Render without replacing cloud data.
create or replace function public.dmc_profile_import(p_token_hash text, p_profile jsonb, p_rounds jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  insert into public.dmc_device_profiles(id, token_hash, body)
  values (p_profile->>'id', p_token_hash, p_profile) on conflict do nothing;
  select body into result from public.dmc_device_profiles where token_hash=p_token_hash;
  if result->>'id' = p_profile->>'id' then
    insert into public.dmc_profile_rounds(profile, game, round)
    select result->>'id', entry->>'game', (entry->>'round')::integer
    from jsonb_array_elements(p_rounds) as entry on conflict do nothing;
  end if;
  return result;
end;
$$;

-- Lock one profile and deduplicate each event in the same transaction. This
-- prevents lost increments and duplicate penalties after retry or redeployment.
create or replace function public.dmc_profile_event(p_id text, p_event text, p_action text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; affected integer;
begin
  select body into result from public.dmc_device_profiles where id=p_id for update;
  if not found then return null; end if;
  insert into public.dmc_profile_events(profile,event) values(p_id,p_event) on conflict do nothing;
  get diagnostics affected = row_count;
  if affected=0 then return result; end if;
  case p_action
    when 'penalty' then
      if coalesce((p_payload->>'units')::integer,0)<=0 then raise exception 'Invalid penalty'; end if;
      result=jsonb_set(result,'{adtHalfUnits}',to_jsonb((result->>'adtHalfUnits')::bigint+(p_payload->>'units')::integer));
    when 'round' then
      insert into public.dmc_profile_rounds(profile,game,round)
      values(p_id,p_payload->>'game',(p_payload->>'round')::integer) on conflict do nothing;
      get diagnostics affected = row_count;
      if affected>0 then result=jsonb_set(result,'{rounds}',to_jsonb((result->>'rounds')::bigint+1)); end if;
    when 'avatar' then result=jsonb_set(result,'{avatar}',p_payload->'avatar');
    when 'reset' then
      if p_payload->>'scope' not in ('adts','all') then raise exception 'Invalid reset'; end if;
      result=jsonb_set(result,'{adtHalfUnits}','0'::jsonb);
      if p_payload->>'scope'='all' then result=jsonb_set(result,'{rounds}','0'::jsonb); end if;
    when 'forget' then
      delete from public.dmc_device_profiles where id=p_id;
      return null;
    else raise exception 'Invalid profile event';
  end case;
  update public.dmc_device_profiles set body=result where id=p_id;
  return result;
end;
$$;

revoke all on function public.dmc_profile_save(text,jsonb), public.dmc_profile_import(text,jsonb,jsonb), public.dmc_profile_event(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.dmc_profile_save(text,jsonb), public.dmc_profile_import(text,jsonb,jsonb), public.dmc_profile_event(text,text,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
