create or replace view public.gx_public_developers as
  select id, display_name, username, avatar_url, created_at
  from public.profiles
  where role in ('developer','owner');
grant select on public.gx_public_developers to anon, authenticated;
