-- Gamer X Store: secure account/developer foundation
create extension if not exists pgcrypto;
do $$ begin
  create type public.gx_role as enum ('user','developer','owner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.gx_request_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique,
 display_name text not null default '',
 role public.gx_role not null default 'user',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.developer_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 app_name text not null check (char_length(app_name) between 1 and 80),
 description text not null check (char_length(description) between 1 and 500),
 reason text not null check (char_length(reason) between 1 and 500),
 status public.gx_request_status not null default 'pending',
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists gx_requests_status_idx on public.developer_requests(status,created_at desc);

create or replace function public.gx_is_owner()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='owner') $$;
create or replace function public.gx_is_developer()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('developer','owner')) $$;

create or replace function public.gx_new_profile()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')) on conflict(id) do nothing;
 return new;
end $$;
drop trigger if exists gx_auth_user_profile on auth.users;
create trigger gx_auth_user_profile after insert on auth.users for each row execute procedure public.gx_new_profile();

alter table public.profiles enable row level security;
alter table public.developer_requests enable row level security;
drop policy if exists "profile read self or owner" on public.profiles;
create policy "profile read self or owner" on public.profiles for select to authenticated using(id=auth.uid() or public.gx_is_owner());
drop policy if exists "profile update self safe fields" on public.profiles;
create policy "profile update self safe fields" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role=(select p.role from public.profiles p where p.id=auth.uid()));
drop policy if exists "request read own or owner" on public.developer_requests;
create policy "request read own or owner" on public.developer_requests for select to authenticated using(user_id=auth.uid() or public.gx_is_owner());
drop policy if exists "request insert own" on public.developer_requests;
create policy "request insert own" on public.developer_requests for insert to authenticated with check(user_id=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null);

create or replace function public.review_developer_request(p_request_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public
as $$ declare r public.developer_requests; begin
 if not public.gx_is_owner() then raise exception 'owner_required'; end if;
 select * into r from public.developer_requests where id=p_request_id for update;
 if not found or r.status <> 'pending' then raise exception 'request_not_pending'; end if;
 update public.developer_requests set status=case when p_approve then 'approved'::public.gx_request_status else 'rejected'::public.gx_request_status end, reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id;
 if p_approve then update public.profiles set role='developer',updated_at=now() where id=r.user_id and role='user'; end if;
end $$;
revoke all on function public.review_developer_request(uuid,boolean) from public;
grant execute on function public.review_developer_request(uuid,boolean) to authenticated;
revoke all on function public.gx_is_owner() from public;
grant execute on function public.gx_is_owner() to anon, authenticated;
revoke all on function public.gx_is_developer() from public;
grant execute on function public.gx_is_developer() to anon, authenticated;

-- ===== Developer email-code verification (server-side only) =====
-- Codes are stored as HMAC hashes. RLS is on with NO policies and all client
-- privileges revoked, so only the Edge Function (service role) can touch it.
create table if not exists public.developer_codes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 code_hash text not null,
 attempts int not null default 0,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.developer_codes enable row level security;
revoke all on public.developer_codes from anon, authenticated;

-- ===== Multi-user hardening =====
do $$ begin
  alter table public.profiles add constraint gx_username_fmt check (username is null or username ~ '^[a-z0-9_]{3,24}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint gx_display_len check (char_length(display_name) <= 40);
exception when duplicate_object then null; end $$;

-- ===== Developer console: apps, releases, APK storage, owner review =====
create table if not exists public.apps (
 id uuid primary key default gen_random_uuid(),
 developer_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 60),
 package_id text not null unique check (package_id ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
 category text not null default 'games',
 description text not null default '' check (char_length(description) <= 2000),
 status text not null default 'draft' check (status in ('draft','review','published','rejected','suspended')),
 review_note text,
 downloads bigint not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.app_releases (
 id uuid primary key default gen_random_uuid(),
 app_id uuid not null references public.apps(id) on delete cascade,
 version_name text not null check (char_length(version_name) between 1 and 30),
 version_code int not null check (version_code > 0),
 apk_path text not null,
 size_bytes bigint,
 notes text not null default '' check (char_length(notes) <= 1000),
 created_at timestamptz not null default now(),
 unique (app_id, version_code)
);
create index if not exists apps_dev_idx on public.apps(developer_id);
create index if not exists apps_status_idx on public.apps(status);
alter table public.apps enable row level security;
alter table public.app_releases enable row level security;

drop policy if exists "apps read published own or owner" on public.apps;
create policy "apps read published own or owner" on public.apps for select using (status='published' or developer_id=auth.uid() or public.gx_is_owner());
drop policy if exists "apps insert developer" on public.apps;
create policy "apps insert developer" on public.apps for insert to authenticated with check (developer_id=auth.uid() and status='draft' and downloads=0 and public.gx_is_developer());
drop policy if exists "apps update own or owner" on public.apps;
create policy "apps update own or owner" on public.apps for update to authenticated using (developer_id=auth.uid() or public.gx_is_owner());
drop policy if exists "apps delete own draft or owner" on public.apps;
create policy "apps delete own draft or owner" on public.apps for delete to authenticated using ((developer_id=auth.uid() and status in ('draft','rejected')) or public.gx_is_owner());
drop policy if exists "releases read visible" on public.app_releases;
create policy "releases read visible" on public.app_releases for select using (exists (select 1 from public.apps a where a.id=app_id));
drop policy if exists "releases insert own" on public.app_releases;
create policy "releases insert own" on public.app_releases for insert to authenticated with check (exists (select 1 from public.apps a where a.id=app_id and a.developer_id=auth.uid() and a.status in ('draft','rejected')));
drop policy if exists "releases delete own draft" on public.app_releases;
create policy "releases delete own draft" on public.app_releases for delete to authenticated using (exists (select 1 from public.apps a where a.id=app_id and a.developer_id=auth.uid() and a.status in ('draft','rejected')));

-- Developers can only move draft/rejected -> review; everything else (publish, reject, suspend) is owner-only.
create or replace function public.gx_apps_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  if public.gx_is_owner() then return new; end if;
  new.developer_id := old.developer_id; new.downloads := old.downloads; new.review_note := old.review_note;
  if new.status <> old.status and not (new.status='review' and old.status in ('draft','rejected')) then
    raise exception 'status change not allowed';
  end if;
  return new;
end $$;
drop trigger if exists gx_apps_guard_t on public.apps;
create trigger gx_apps_guard_t before update on public.apps for each row execute function public.gx_apps_guard();

create or replace function public.gx_count_download(p_app uuid) returns void language sql security definer set search_path=public as
$$ update public.apps set downloads = downloads + 1 where id = p_app and status = 'published' $$;
grant execute on function public.gx_count_download(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit) values ('apks','apks',true,52428800) on conflict (id) do nothing;
drop policy if exists "apk upload own folder" on storage.objects;
create policy "apk upload own folder" on storage.objects for insert to authenticated with check (bucket_id='apks' and (storage.foldername(name))[1]=auth.uid()::text and name ilike '%.apk' and public.gx_is_developer());
drop policy if exists "apk delete own folder" on storage.objects;
create policy "apk delete own folder" on storage.objects for delete to authenticated using (bucket_id='apks' and (storage.foldername(name))[1]=auth.uid()::text);

-- Public (name-only) view so the store can show the developer's name without exposing profiles.
create or replace view public.gx_public_developers as select id, display_name, username from public.profiles where role in ('developer','owner');
grant select on public.gx_public_developers to anon, authenticated;

-- ===== update 2: avatars + profile self-repair =====
alter table public.profiles add column if not exists avatar_url text;
do $$ begin
  alter table public.profiles add constraint gx_avatar_fmt check (avatar_url is null or (char_length(avatar_url) <= 60000 and avatar_url ~ '^(preset:[0-9]{1,2}|data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+)$'));
exception when duplicate_object then null; end $$;

-- accounts created before the SQL ran have no profile row: create them now
insert into public.profiles(id,display_name) select id, coalesce(raw_user_meta_data->>'display_name','') from auth.users on conflict (id) do nothing;

create or replace function public.gx_ensure_profile() returns text language plpgsql security definer set search_path=public as $$
declare r text;
begin
  if auth.uid() is null then return null; end if;
  insert into public.profiles(id,display_name) select id, coalesce(raw_user_meta_data->>'display_name','') from auth.users where id=auth.uid() on conflict (id) do nothing;
  select role::text into r from public.profiles where id=auth.uid();
  return r;
end $$;
revoke all on function public.gx_ensure_profile() from public;
grant execute on function public.gx_ensure_profile() to authenticated;
-- ===== update 3: app icons, edit app, reviewed updates for published apps =====
alter table public.apps add column if not exists icon_path text;
alter table public.app_releases add column if not exists status text not null default 'approved';
alter table public.app_releases add column if not exists review_note text;
do $$ begin
  alter table public.app_releases add constraint gx_rel_status check (status in ('approved','pending','rejected'));
exception when duplicate_object then null; end $$;

-- public sees only approved releases; developer sees own; owner sees all
drop policy if exists "releases read visible" on public.app_releases;
create policy "releases read visible" on public.app_releases for select using (
  exists (select 1 from public.apps a where a.id = app_releases.app_id)
  and (app_releases.status = 'approved' or public.gx_is_owner()
       or exists (select 1 from public.apps a where a.id = app_releases.app_id and a.developer_id = auth.uid())));

-- new release: draft/rejected app -> approved (reviewed with the app); published app -> pending (needs owner review)
drop policy if exists "releases insert own" on public.app_releases;
create policy "releases insert own" on public.app_releases for insert to authenticated with check (
  exists (select 1 from public.apps a where a.id = app_releases.app_id and a.developer_id = auth.uid()
          and ((a.status in ('draft','rejected') and app_releases.status = 'approved')
            or (a.status = 'published' and app_releases.status = 'pending'))));

drop policy if exists "releases delete own draft" on public.app_releases;
create policy "releases delete own draft" on public.app_releases for delete to authenticated using (
  exists (select 1 from public.apps a where a.id = app_releases.app_id and a.developer_id = auth.uid()
          and (a.status in ('draft','rejected') or app_releases.status in ('pending','rejected'))));

drop policy if exists "releases owner update" on public.app_releases;
create policy "releases owner update" on public.app_releases for update to authenticated using (public.gx_is_owner()) with check (public.gx_is_owner());

create or replace function public.gx_apps_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  if public.gx_is_owner() then return new; end if;
  new.developer_id := old.developer_id; new.downloads := old.downloads; new.review_note := old.review_note; new.package_id := old.package_id;
  if new.name <> old.name and old.status not in ('draft','rejected') then raise exception 'name locked after review'; end if;
  if new.status <> old.status and not (new.status='review' and old.status in ('draft','rejected')) then
    raise exception 'status change not allowed';
  end if;
  return new;
end $$;

insert into storage.buckets (id, name, public, file_size_limit) values ('app-media','app-media',true,2097152) on conflict (id) do nothing;
drop policy if exists "media insert own" on storage.objects;
create policy "media insert own" on storage.objects for insert to authenticated with check (bucket_id='app-media' and (storage.foldername(name))[1]=auth.uid()::text and name ~* '\.(webp|png|jpe?g)$' and public.gx_is_developer());
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete to authenticated using (bucket_id='app-media' and (storage.foldername(name))[1]=auth.uid()::text);
