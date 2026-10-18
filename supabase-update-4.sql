-- ===== update 4: self-service developer account, instant publishing, real favorites =====
-- شغّل هذا الملف مرة واحدة فقط في Supabase > SQL Editor (آمن لو اتشغل أكتر من مرة).

-- 1) تحويل الحساب إلى مطور مباشرة (بدون موافقة المالك). يشترط بريد مؤكد.
create or replace function public.gx_become_developer() returns text language plpgsql security definer set search_path=public as $$
declare r text; confirmed timestamptz;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  select email_confirmed_at into confirmed from auth.users where id=auth.uid();
  if confirmed is null then raise exception 'email_not_confirmed'; end if;
  insert into public.profiles(id,display_name) select id, coalesce(raw_user_meta_data->>'display_name','') from auth.users where id=auth.uid() on conflict (id) do nothing;
  update public.profiles set role='developer', updated_at=now() where id=auth.uid() and role='user';
  select role::text into r from public.profiles where id=auth.uid();
  return r;
end $$;
revoke all on function public.gx_become_developer() from public;
grant execute on function public.gx_become_developer() to authenticated;

-- 2) النشر المباشر: المطور ينشئ تطبيقه بحالة published ويرفع الإصدار معتمدًا.
drop policy if exists "apps insert developer" on public.apps;
create policy "apps insert developer" on public.apps for insert to authenticated
  with check (developer_id=auth.uid() and status='published' and downloads=0 and public.gx_is_developer());

drop policy if exists "apps delete own draft or owner" on public.apps;
drop policy if exists "apps delete own or owner" on public.apps;
create policy "apps delete own or owner" on public.apps for delete to authenticated
  using (developer_id=auth.uid() or public.gx_is_owner());

-- المطور يعدّل الاسم والوصف والتصنيف واللوجو فقط. الحالة والتنزيلات للمالك/النظام.
create or replace function public.gx_apps_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at := now();
  if public.gx_is_owner() then return new; end if;
  new.developer_id := old.developer_id; new.downloads := old.downloads; new.review_note := old.review_note;
  new.package_id := old.package_id; new.status := old.status;
  return new;
end $$;

drop policy if exists "releases insert own" on public.app_releases;
create policy "releases insert own" on public.app_releases for insert to authenticated
  with check (app_releases.status='approved' and public.gx_is_developer()
    and exists (select 1 from public.apps a where a.id=app_releases.app_id and a.developer_id=auth.uid() and a.status='published'));

-- 3) المفضلة الحقيقية: عشان المطور يشوف كام واحد ضاف تطبيقه للمفضلة.
create table if not exists public.app_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, app_id)
);
create index if not exists app_favorites_app_idx on public.app_favorites(app_id);
alter table public.app_favorites enable row level security;
revoke all on public.app_favorites from anon;
grant select, insert, delete on public.app_favorites to authenticated;
drop policy if exists "fav read own" on public.app_favorites;
create policy "fav read own" on public.app_favorites for select to authenticated using (user_id=auth.uid());
drop policy if exists "fav insert own" on public.app_favorites;
create policy "fav insert own" on public.app_favorites for insert to authenticated
  with check (user_id=auth.uid() and exists (select 1 from public.apps a where a.id=app_id and a.status='published'));
drop policy if exists "fav delete own" on public.app_favorites;
create policy "fav delete own" on public.app_favorites for delete to authenticated using (user_id=auth.uid());

-- إحصائيات تطبيقات المطور (عدد المفضلة) — يرجّع فقط تطبيقات صاحب الحساب.
create or replace function public.gx_dev_app_stats() returns table(app_id uuid, favorites bigint)
language sql stable security definer set search_path=public as $$
  select a.id, count(f.user_id) from public.apps a left join public.app_favorites f on f.app_id=a.id
  where a.developer_id=auth.uid() group by a.id
$$;
revoke all on function public.gx_dev_app_stats() from public;
grant execute on function public.gx_dev_app_stats() to authenticated;
