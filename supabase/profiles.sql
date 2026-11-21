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

alter table public.dmc_device_profiles add column if not exists account_user_id uuid;
create unique index if not exists dmc_profile_account_owner on public.dmc_device_profiles(account_user_id);

alter table public.dmc_device_profiles enable row level security;
alter table public.dmc_profile_events enable row level security;
alter table public.dmc_profile_rounds enable row level security;
revoke all on public.dmc_device_profiles, public.dmc_profile_events, public.dmc_profile_rounds from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.dmc_device_profiles, public.dmc_profile_events, public.dmc_profile_rounds to service_role;

-- Friends and permanent groups live in Supabase, independently of game rooms.
create table if not exists public.dmc_friends (
 requester text not null references public.dmc_device_profiles(id) on delete cascade,
 recipient text not null references public.dmc_device_profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 primary key(requester,recipient), check(requester<>recipient)
);
create unique index if not exists dmc_friend_pair on public.dmc_friends(least(requester,recipient),greatest(requester,recipient));
create table if not exists public.dmc_groups (
 id text primary key, name text not null check(length(name) between 1 and 40),
 tag text unique not null check(tag ~ '^[A-Z0-9]{2,6}$'),
 visibility text not null check(visibility in ('public','approval')),
 invite_hash text, rules jsonb, created_at timestamptz not null default now()
);
alter table public.dmc_groups add column if not exists rules jsonb;
create table if not exists public.dmc_group_members (
 group_id text not null references public.dmc_groups(id) on delete cascade,
 profile_id text not null references public.dmc_device_profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('member','admin')),
 status text not null default 'pending' check(status in ('pending','member','left')),
 joined_at timestamptz not null default now(),
 adt_half_units bigint not null default 0 check(adt_half_units>=0),
 rounds bigint not null default 0 check(rounds>=0),
 primary key(group_id,profile_id)
);
alter table public.dmc_friends enable row level security;
alter table public.dmc_groups enable row level security;
alter table public.dmc_group_members enable row level security;
revoke all on public.dmc_friends,public.dmc_groups,public.dmc_group_members from public,anon,authenticated;
grant select,insert,update,delete on public.dmc_friends,public.dmc_groups,public.dmc_group_members to service_role;

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
      update public.dmc_group_members set adt_half_units=adt_half_units+(p_payload->>'units')::integer where group_id=p_payload->>'groupId' and profile_id=p_id and status='member';
    when 'round' then
      insert into public.dmc_profile_rounds(profile,game,round)
      values(p_id,p_payload->>'game',(p_payload->>'round')::integer) on conflict do nothing;
      get diagnostics affected = row_count;
      if affected>0 then
        result=jsonb_set(result,'{rounds}',to_jsonb((result->>'rounds')::bigint+1));
        update public.dmc_group_members set rounds=rounds+1 where group_id=p_payload->>'groupId' and profile_id=p_id and status='member';
      end if;
    when 'avatar' then result=jsonb_set(result,'{avatar}',p_payload->'avatar');
    when 'reset' then
      if p_payload->>'scope' not in ('adts','all') then raise exception 'Invalid reset'; end if;
      result=jsonb_set(result,'{adtHalfUnits}','0'::jsonb);
      if p_payload->>'scope'='all' then result=jsonb_set(result,'{rounds}','0'::jsonb); end if;
    when 'forget' then
      update public.dmc_group_members m set role='admin' where m.profile_id=(
        select successor.profile_id from public.dmc_group_members successor
        where successor.group_id=m.group_id and successor.profile_id<>p_id and successor.status='member'
        order by successor.joined_at,successor.profile_id limit 1)
      and m.group_id in (select group_id from public.dmc_group_members where profile_id=p_id and role='admin' and status='member')
      and not exists(select 1 from public.dmc_group_members other where other.group_id=m.group_id and other.profile_id<>p_id and other.role='admin' and other.status='member');
      delete from public.dmc_groups g where not exists(select 1 from public.dmc_group_members m where m.group_id=g.id and m.profile_id<>p_id and m.status='member')
        and exists(select 1 from public.dmc_group_members m where m.group_id=g.id and m.profile_id=p_id and m.role='admin');
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
-- Only a verified Supabase Auth user may be passed here by the Render server.
-- First login can claim that browser's existing, still-unlinked device profile.
create or replace function public.dmc_profile_account(p_user_id uuid, p_device_hash text, p_new_hash text, p_profile jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.dmc_device_profiles%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  select * into existing from public.dmc_device_profiles where account_user_id=p_user_id for update;
  if not found and p_device_hash is not null then
    select * into existing from public.dmc_device_profiles where token_hash=p_device_hash for update;
    if found and existing.account_user_id is null then
      update public.dmc_device_profiles set account_user_id=p_user_id where id=existing.id returning * into existing;
    else existing.id=null;
    end if;
  end if;
  if existing.id is null then
    insert into public.dmc_device_profiles(id,token_hash,body,account_user_id)
    values(p_profile->>'id',p_new_hash,p_profile,p_user_id) returning * into existing;
  end if;
  return jsonb_build_object('profile',existing.body,'token_hash',existing.token_hash);
end;
$$;
revoke all on function public.dmc_profile_account(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.dmc_profile_account(uuid,text,text,jsonb) to service_role;

-- Public profile fields only: never return Auth identities or device hashes.
create or replace function public.dmc_social_profile(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.body->'name','avatar',p.body->'avatar',
 'joinedAt',p.body->'joinedAt','rounds',p.body->'rounds','adtHalfUnits',p.body->'adtHalfUnits',
 'hasAccount',p.account_user_id is not null,'tags',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'tag',g.tag,'name',g.name))
 from public.dmc_group_members m join public.dmc_groups g on g.id=m.group_id where m.profile_id=p.id and m.status='member'),'[]'::jsonb))
 from public.dmc_device_profiles p where p.id=p_id;
$$;

-- p_actor is supplied only by the server after verifying the Supabase session.
create or replace function public.dmc_social(p_actor text,p_action text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare gid text:=p_input->>'groupId'; target text:=p_input->>'profileId';
 grp public.dmc_groups%rowtype; membership public.dmc_group_members%rowtype;
 relation public.dmc_friends%rowtype; result jsonb; is_admin boolean; top_units bigint;
begin
 if p_action='profile' then
  result=public.dmc_social_profile(target);
  if result is null then return jsonb_build_object('error','Dit profiel bestaat niet meer.','status',404); end if;
  select * into relation from public.dmc_friends where (requester=p_actor and recipient=target) or (requester=target and recipient=p_actor);
  return jsonb_build_object('profile',result,'friendship',case when relation.status='accepted' then 'accepted' when relation.requester=p_actor then 'sent' when relation.recipient=p_actor then 'received' else 'none' end,'self',target=p_actor);
 end if;
 if not exists(select 1 from public.dmc_device_profiles where id=p_actor and account_user_id is not null) then
  return jsonb_build_object('error','Log in met een account om vrienden en groepen te gebruiken.','status',401);
 end if;
 if p_action='overview' then
  return jsonb_build_object('me',public.dmc_social_profile(p_actor),
   'friends',coalesce((select jsonb_agg(jsonb_build_object('profile',public.dmc_social_profile(case when requester=p_actor then recipient else requester end),
    'status',case when status='accepted' then 'accepted' when requester=p_actor then 'sent' else 'received' end)) from public.dmc_friends where requester=p_actor or recipient=p_actor),'[]'::jsonb),
   'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'tag',g.tag,'visibility',g.visibility,'status',m.status,'role',m.role))
    from public.dmc_group_members m join public.dmc_groups g on g.id=m.group_id where m.profile_id=p_actor and m.status<>'left'),'[]'::jsonb),
   'discover',coalesce((select jsonb_agg(x) from (select g.id,g.name,g.tag,g.visibility from public.dmc_groups g
    where not exists(select 1 from public.dmc_group_members m where m.group_id=g.id and m.profile_id=p_actor and m.status<>'left')
    and (g.name ilike '%'||left(coalesce(p_input->>'search',''),40)||'%' or g.tag ilike '%'||left(coalesce(p_input->>'search',''),40)||'%') order by g.created_at desc limit 30) x),'[]'::jsonb));
 end if;
 if p_action like 'friend_%' then
  if target is null or target=p_actor or not exists(select 1 from public.dmc_device_profiles where id=target and account_user_id is not null) then
   return jsonb_build_object('error','Kies een andere speler met een account.','status',400); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(p_actor,target)||':'||greatest(p_actor,target),1));
  select * into relation from public.dmc_friends where (requester=p_actor and recipient=target) or (requester=target and recipient=p_actor) for update;
  if p_action='friend_request' then
   if relation.requester is null then insert into public.dmc_friends(requester,recipient) values(p_actor,target); end if;
  elsif p_action='friend_accept' then
   if relation.recipient<>p_actor or relation.requester is null then return jsonb_build_object('error','Geen ontvangen vriendschapsverzoek.','status',409); end if;
   update public.dmc_friends set status='accepted' where requester=target and recipient=p_actor;
  elsif p_action='friend_remove' then
   delete from public.dmc_friends where (requester=p_actor and recipient=target) or (requester=target and recipient=p_actor);
  else return jsonb_build_object('error','Onbekende vriendenactie.','status',400);
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='group_create' then
  if coalesce(length(trim(p_input->>'name')),0) not between 1 and 40 or coalesce(p_input->>'tag','') !~ '^[A-Z0-9]{2,6}$' or coalesce(p_input->>'visibility','') not in ('public','approval') then
   return jsonb_build_object('error','Kies een naam, een tag van 2–6 letters/cijfers en een toegangstype.','status',400); end if;
  if (select count(*) from public.dmc_group_members where profile_id=p_actor and role='admin' and status='member')>=20 then return jsonb_build_object('error','Je beheert al 20 groepen.','status',409); end if;
  gid=gen_random_uuid()::text;
  insert into public.dmc_groups(id,name,tag,visibility) values(gid,trim(p_input->>'name'),p_input->>'tag',p_input->>'visibility');
  insert into public.dmc_group_members(group_id,profile_id,role,status) values(gid,p_actor,'admin','member');
  return jsonb_build_object('id',gid);
 end if;
 -- Serialize group membership/admin changes, including last-admin protection.
 select * into grp from public.dmc_groups where id=gid for update;
 if not found then return jsonb_build_object('error','Deze groep bestaat niet.','status',404); end if;
 select * into membership from public.dmc_group_members where group_id=gid and profile_id=p_actor;
 is_admin=coalesce(membership.status='member' and membership.role='admin',false);
 if p_action='group_join' then
  if membership.status='member' then return jsonb_build_object('ok',true,'status','member'); end if;
  if coalesce(membership.status,'left')='left' and (select count(*) from public.dmc_group_members where group_id=gid and status<>'left')>=200 then return jsonb_build_object('error','Deze groep zit vol.','status',409); end if;
  insert into public.dmc_group_members(group_id,profile_id,status) values(gid,p_actor,
   case when grp.visibility='public' or (grp.invite_hash is not null and grp.invite_hash=p_input->>'inviteHash') then 'member' else 'pending' end)
  on conflict(group_id,profile_id) do update set status=excluded.status;
  return jsonb_build_object('ok',true,'status',(select status from public.dmc_group_members where group_id=gid and profile_id=p_actor));
 end if;
 if p_action='group_get' then
  if membership.status is distinct from 'member' then
   return jsonb_build_object('id',grp.id,'name',grp.name,'tag',grp.tag,'visibility',grp.visibility,'status',coalesce(membership.status,'none'),'role','member','members','[]'::jsonb,'requests','[]'::jsonb);
  end if;
  select coalesce(max(adt_half_units),0) into top_units from public.dmc_group_members where group_id=gid and status='member';
  return jsonb_build_object('id',grp.id,'name',grp.name,'tag',grp.tag,'visibility',grp.visibility,'status','member','role',membership.role,
   'members',coalesce((select jsonb_agg(jsonb_build_object('profile',public.dmc_social_profile(profile_id),'role',role,'adtHalfUnits',adt_half_units,'rounds',rounds,'leader',adt_half_units=top_units and top_units>0) order by adt_half_units desc,rounds desc,joined_at,profile_id)
    from public.dmc_group_members where group_id=gid and status='member'),'[]'::jsonb),
   'requests',case when is_admin then coalesce((select jsonb_agg(public.dmc_social_profile(profile_id)) from public.dmc_group_members where group_id=gid and status='pending'),'[]'::jsonb) else '[]'::jsonb end);
 end if;
 if p_action='group_access' then
  if membership.status is distinct from 'member' then return jsonb_build_object('error','Word eerst lid van deze groep.','status',403); end if;
  return jsonb_build_object('id',grp.id,'name',grp.name,'tag',grp.tag,'isAdmin',is_admin,'rules',grp.rules);
 end if;
 if p_action='group_rules' and membership.status='member' then
  update public.dmc_groups set rules=p_input->'rules' where id=gid;return jsonb_build_object('ok',true);
 end if;
 if p_action='group_leave' then target=p_actor;
 elsif not is_admin then return jsonb_build_object('error','Alleen groepsbeheerders kunnen dit aanpassen.','status',403);
 end if;
 if p_action='group_update' then
  if coalesce(length(trim(p_input->>'name')),0) not between 1 and 40 or coalesce(p_input->>'visibility','') not in ('public','approval') then return jsonb_build_object('error','Controleer naam en toegangstype.','status',400); end if;
  update public.dmc_groups set name=trim(p_input->>'name'),visibility=p_input->>'visibility' where id=gid;
 elsif p_action='group_invite' then
  if coalesce(p_input->>'inviteHash','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','Ongeldige uitnodiging.','status',400); end if;
  update public.dmc_groups set invite_hash=p_input->>'inviteHash' where id=gid;
 elsif p_action in ('group_approve','group_role','group_remove','group_leave') then
  select * into membership from public.dmc_group_members where group_id=gid and profile_id=target for update;
  if not found then return jsonb_build_object('error','Dit lid bestaat niet.','status',404); end if;
  if membership.role='admin' and membership.status='member' and (p_action in ('group_remove','group_leave') or (p_action='group_role' and p_input->>'role'='member'))
   and (select count(*) from public.dmc_group_members where group_id=gid and status='member' and role='admin')<=1 then
   return jsonb_build_object('error','Wijs eerst een andere beheerder aan.','status',409); end if;
  if p_action='group_approve' then update public.dmc_group_members set status='member' where group_id=gid and profile_id=target;
  elsif p_action='group_role' then
   if coalesce(p_input->>'role','') not in ('admin','member') or membership.status<>'member' then return jsonb_build_object('error','Ongeldige beheerdersrol.','status',400); end if;
   update public.dmc_group_members set role=p_input->>'role' where group_id=gid and profile_id=target;
  else update public.dmc_group_members set status='left',role='member' where group_id=gid and profile_id=target;
  end if;
 else return jsonb_build_object('error','Onbekende groepsactie.','status',400);
 end if;
 return jsonb_build_object('ok',true);
exception when unique_violation then return jsonb_build_object('error','Deze tag is al in gebruik.','status',409);
end;
$$;
revoke all on function public.dmc_social_profile(text),public.dmc_social(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.dmc_social_profile(text),public.dmc_social(text,text,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
