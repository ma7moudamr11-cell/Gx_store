create extension if not exists pgcrypto;

create table if not exists public.gx_admin_secrets (name text primary key, salt text not null, hash text not null);
create table if not exists public.gx_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table if not exists public.gx_admin_sessions (token_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade, expires_at timestamptz not null);
create table if not exists public.gx_admin_attempts (id bigserial primary key, kind text not null, user_id uuid, ip text, ok boolean not null, created_at timestamptz not null default now());
create table if not exists public.gx_security_events (id bigserial primary key, kind text not null, severity int not null default 1, user_id uuid, detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists gx_security_events_time on public.gx_security_events(created_at desc);
create index if not exists gx_admin_attempts_time on public.gx_admin_attempts(created_at desc);
create table if not exists public.gx_user_flags (user_id uuid primary key references auth.users(id) on delete cascade, banned boolean not null default false, ban_reason text, strikes int not null default 0, muted_until timestamptz, updated_at timestamptz not null default now());
create table if not exists public.gx_banned_words (word text primary key, severity int not null default 1 check (severity in (1,2)));

create table if not exists public.app_reviews (app_id uuid not null references public.apps(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, rating int not null check (rating between 1 and 5), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (app_id, user_id));
create table if not exists public.app_comments (id uuid primary key default gen_random_uuid(), app_id uuid not null references public.apps(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, body text not null check (char_length(body) between 2 and 500), hidden boolean not null default false, created_at timestamptz not null default now());
create index if not exists app_comments_app_idx on public.app_comments(app_id, created_at desc);
create table if not exists public.app_comment_reports (comment_id uuid not null references public.app_comments(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, reason text, created_at timestamptz not null default now(), primary key (comment_id, user_id));

alter table public.gx_admin_secrets enable row level security;
alter table public.gx_admins enable row level security;
alter table public.gx_admin_sessions enable row level security;
alter table public.gx_admin_attempts enable row level security;
alter table public.gx_security_events enable row level security;
alter table public.gx_user_flags enable row level security;
alter table public.gx_banned_words enable row level security;
alter table public.app_reviews enable row level security;
alter table public.app_comments enable row level security;
alter table public.app_comment_reports enable row level security;
revoke all on public.gx_admin_secrets, public.gx_admins, public.gx_admin_sessions, public.gx_admin_attempts, public.gx_security_events, public.gx_user_flags, public.gx_banned_words, public.app_reviews, public.app_comments, public.app_comment_reports from anon, authenticated;

insert into public.gx_admin_secrets(name,salt,hash) values
 ('gate','420cdbe6894f51bd6ab9263d5bbc1cad','1b3192657ab7e74020448ae26692e5c6e2e91041d48a79eb403f541c724211bb'),
 ('key','3866ed0ad13c1b4f7ab14009169ecea3','1a08f154a8d77a7deef95b6e01e95ff6e7cc489036a2bb6f03ddd25008905030')
on conflict (name) do update set salt=excluded.salt, hash=excluded.hash;

create or replace function public.gx_norm(t text) returns text language sql immutable as $$
  select lower(translate(regexp_replace(coalesce(t,''), '[\u064B-\u065F\u0640\u0670]', '', 'g'), U&'\0623\0625\0622\0649\0629\0624\0626', U&'\0627\0627\0627\064A\0647\0648\064A'))
$$;
create or replace function public.gx_squeeze(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(translate(public.gx_norm(t), '0134@$5', 'oieaass'), U&'[\\s.\\-_*,/\\\\|~`''"!?:;()\\[\\]{}<>+=^%#&\060C\061B\061F]', '', 'g'), '(.)\1+', '\1', 'g')
$$;
create or replace function public.gx_tokens(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(translate(public.gx_norm(t), '0134@$5', 'oieaass'), U&'[\\s.\\-_*,/\\\\|~`''"!?:;()\\[\\]{}<>+=^%#&\060C\061B\061F]+', ' ', 'g'), '(.)\1+', '\1', 'g')
$$;
create or replace function public.gx_has_link(t text) returns boolean language sql immutable as $$
  select coalesce(t,'') ~* '(https?:|www\.|\.(com|net|org|io|me|ly|xyz|ru|cc|tk)\M|t\.me|wa\.me|[0-9]{8,})'
$$;
create or replace function public.gx_bad_text(t text) returns boolean language plpgsql stable as $$
declare s text := public.gx_squeeze(t); tok text[] := string_to_array(public.gx_tokens(t), ' '); r record; w text; k text;
begin
  for r in select word, severity from public.gx_banned_words loop
    w := public.gx_squeeze(r.word);
    if w = '' then continue; end if;
    if r.severity >= 2 then
      if position(w in s) > 0 then return true; end if;
    else
      foreach k in array tok loop
        if k = w then return true; end if;
        if w ~ '^[\u0621-\u064A]' and char_length(k) between char_length(w)+1 and char_length(w)+2 and right(k, char_length(w)) = w then return true; end if;
      end loop;
    end if;
  end loop;
  return false;
end $$;

insert into public.gx_banned_words(word,severity) values
 (U&'\0643\0633\0645\0643',2),(U&'\0643\0633 \0627\0645\0643',2),(U&'\0645\0646\064A\0648\0643',2),(U&'\0627\0628\0646 \0627\0644\0645\062A\0646\0627\0643\0647',2),(U&'\0627\0628\0646 \0627\0644\0634\0631\0645\0648\0637\0647',2),(U&'\0627\0628\0646 \0627\0644\0642\062D\0628\0647',2),(U&'\0627\0628\0646 \0627\0644\0643\0644\0628',2),(U&'\0634\0631\0645\0648\0637',2),(U&'\0634\0631\0645\0648\0637\0647',2),(U&'\0642\062D\0628\0647',2),(U&'\0639\0627\0647\0631\0647',2),
 (U&'\0639\0631\0635',1),(U&'\062E\0648\0644',1),(U&'\0645\062A\0646\0627\0643',1),(U&'\0632\0628\064A',1),(U&'\0643\0644\0628',1),(U&'\062D\0645\0627\0631',1),(U&'\063A\0628\064A',1),(U&'\062D\0642\064A\0631',1),(U&'\0632\0628\0627\0644\0647',1),(U&'\0642\0630\0631',1),(U&'\0648\0627\0637\064A',1),(U&'\062A\0627\0641\0647',1),(U&'\062D\064A\0648\0627\0646',1),(U&'\0645\0639\0641\0646',1),(U&'\0646\062F\0644',1),(U&'\062E\0646\0632\064A\0631',1),(U&'\0627\0647\0628\0644',1),(U&'\0645\062A\062E\0644\0641',1),(U&'\0645\0646\062D\0637',1),
 ('fuck',2),('motherfucker',2),('bitch',2),('asshole',2),('nigger',2),('faggot',2),
 ('shit',1),('cunt',1),('whore',1),('slut',1),('stupid',1),('idiot',1),('moron',1),('retard',1),('scum',1),('loser',1),('dumb',1),('trash',1)
on conflict (word) do nothing;

create or replace function public.gx_app_rating(p_app uuid) returns json language sql security definer set search_path=public,extensions as $$
  select json_build_object('avg', coalesce(round(avg(rating)::numeric,1),0), 'count', count(*),
    'mine', (select rating from public.app_reviews where app_id=p_app and user_id=auth.uid()))
  from public.app_reviews where app_id=p_app
$$;
create or replace function public.gx_rate_app(p_app uuid, p_rating int) returns json language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return json_build_object('ok',false,'error',U&'\0633\062C\0651\0644 \0627\0644\062F\062E\0648\0644 \0623\0648\0644\064B\0627 \0644\0644\062A\0642\064A\064A\0645.'); end if;
  if p_rating is null or p_rating not between 1 and 5 then return json_build_object('ok',false,'error',U&'\062A\0642\064A\064A\0645 \063A\064A\0631 \0635\0627\0644\062D.'); end if;
  if exists (select 1 from public.gx_user_flags where user_id=uid and banned) then return json_build_object('ok',false,'error',U&'\062A\0645 \0625\064A\0642\0627\0641 \062D\0633\0627\0628\0643.'); end if;
  if not exists (select 1 from public.apps where id=p_app and status='published') then return json_build_object('ok',false,'error',U&'\0627\0644\062A\0637\0628\064A\0642 \063A\064A\0631 \0645\062A\0627\062D.'); end if;
  if exists (select 1 from public.apps where id=p_app and developer_id=uid) then return json_build_object('ok',false,'error',U&'\0644\0627 \064A\0645\0643\0646\0643 \062A\0642\064A\064A\0645 \062A\0637\0628\064A\0642\0643.'); end if;
  insert into public.app_reviews(app_id,user_id,rating) values (p_app,uid,p_rating)
  on conflict (app_id,user_id) do update set rating=excluded.rating, updated_at=now();
  return json_build_object('ok',true);
end $$;

create or replace function public.gx_post_comment(p_app uuid, p_body text) returns json language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid := auth.uid(); f public.gx_user_flags; b text := btrim(coalesce(p_body,'')); n int; reason text; strikes_now int; mute interval;
begin
  if uid is null then return json_build_object('ok',false,'error',U&'\0633\062C\0651\0644 \0627\0644\062F\062E\0648\0644 \0623\0648\0644\064B\0627 \0644\0644\062A\0639\0644\064A\0642.'); end if;
  if not exists (select 1 from public.apps where id=p_app and status='published') then return json_build_object('ok',false,'error',U&'\0627\0644\062A\0637\0628\064A\0642 \063A\064A\0631 \0645\062A\0627\062D.'); end if;
  select * into f from public.gx_user_flags where user_id=uid;
  if found and f.banned then return json_build_object('ok',false,'error',U&'\062A\0645 \0625\064A\0642\0627\0641 \062D\0633\0627\0628\0643 \0639\0646 \0627\0644\062A\0639\0644\064A\0642.'); end if;
  if found and f.muted_until is not null and f.muted_until > now() then return json_build_object('ok',false,'error',U&'\062A\0645 \0645\0646\0639\0643 \0645\0624\0642\062A\064B\0627 \0645\0646 \0627\0644\062A\0639\0644\064A\0642 \0628\0633\0628\0628 \0645\062E\0627\0644\0641\0627\062A \0633\0627\0628\0642\0629.'); end if;
  if char_length(b) < 2 or char_length(b) > 500 then return json_build_object('ok',false,'error',U&'\0627\0644\062A\0639\0644\064A\0642 \0644\0627\0632\0645 \064A\0643\0648\0646 \0645\0646 2 \0625\0644\0649 500 \062D\0631\0641.'); end if;
  select count(*) into n from public.app_comments where user_id=uid and created_at > now() - interval '1 minute';
  if n >= 3 then return json_build_object('ok',false,'error',U&'\0628\0631\0627\062D\0629 \0634\0648\064A\0629 \2014 \062D\0627\0648\0644 \0628\0639\062F \062F\0642\064A\0642\0629.'); end if;
  if exists (select 1 from public.app_comments where user_id=uid and app_id=p_app and body=b and created_at > now() - interval '1 day') then return json_build_object('ok',false,'error',U&'\0627\0644\062A\0639\0644\064A\0642 \062F\0647 \0645\0643\0631\0631.'); end if;
  reason := case when public.gx_has_link(b) then 'link' when public.gx_bad_text(b) then 'abuse' else null end;
  if reason is not null then
    insert into public.gx_security_events(kind,severity,user_id,detail) values ('blocked_comment', case when reason='abuse' then 2 else 1 end, uid, jsonb_build_object('reason',reason,'app_id',p_app,'text',left(b,200)));
    insert into public.gx_user_flags(user_id,strikes) values (uid,1) on conflict (user_id) do update set strikes=public.gx_user_flags.strikes+1, updated_at=now();
    select strikes into strikes_now from public.gx_user_flags where user_id=uid;
    if strikes_now >= 3 then
      mute := case when strikes_now >= 6 then interval '7 days' else interval '1 day' end;
      update public.gx_user_flags set muted_until = now() + mute, updated_at=now() where user_id=uid;
      insert into public.gx_security_events(kind,severity,user_id,detail) values ('auto_mute',3,uid,jsonb_build_object('strikes',strikes_now));
    end if;
    return json_build_object('ok',false,'error', case when reason='link' then U&'\0645\0645\0646\0648\0639 \0648\0636\0639 \0631\0648\0627\0628\0637 \0623\0648 \0623\0631\0642\0627\0645 \0647\0648\0627\062A\0641 \0641\064A \0627\0644\062A\0639\0644\064A\0642\0627\062A.' else U&'\0627\0644\062A\0639\0644\064A\0642 \0641\064A\0647 \0623\0644\0641\0627\0638 \063A\064A\0631 \0644\0627\0626\0642\0629. \0627\0644\0631\062C\0627\0621 \0627\0644\0627\0644\062A\0632\0627\0645 \0628\0627\0644\0627\062D\062A\0631\0627\0645. \062A\0643\0631\0627\0631 \0627\0644\0645\062E\0627\0644\0641\0629 \064A\0624\062F\064A \0644\0644\0645\0646\0639.' end);
  end if;
  insert into public.app_comments(app_id,user_id,body) values (p_app,uid,b);
  return json_build_object('ok',true);
end $$;

create or replace function public.gx_report_comment(p_id uuid, p_reason text) returns json language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then return json_build_object('ok',false,'error',U&'\0633\062C\0651\0644 \0627\0644\062F\062E\0648\0644 \0623\0648\0644\064B\0627.'); end if;
  insert into public.app_comment_reports(comment_id,user_id,reason) values (p_id,uid,left(coalesce(p_reason,''),200)) on conflict do nothing;
  select count(*) into n from public.app_comment_reports where comment_id=p_id;
  if n >= 3 then update public.app_comments set hidden=true where id=p_id; end if;
  insert into public.gx_security_events(kind,severity,user_id,detail) values ('comment_report',1,uid,jsonb_build_object('comment_id',p_id,'reports',n));
  return json_build_object('ok',true);
end $$;

create or replace view public.gx_app_comments_v as
  select c.id, c.app_id, c.user_id, c.body, c.created_at, coalesce(nullif(p.display_name,''), p.username, U&'\0645\0633\062A\062E\062F\0645') as author, p.username
  from public.app_comments c join public.profiles p on p.id=c.user_id where c.hidden=false;
grant select on public.gx_app_comments_v to anon, authenticated;
grant execute on function public.gx_app_rating(uuid) to anon, authenticated;
grant execute on function public.gx_rate_app(uuid,int), public.gx_post_comment(uuid,text), public.gx_report_comment(uuid,text) to authenticated;

create or replace function public.gx_admin_gate(p_code text) returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare v_ip text := coalesce(split_part(coalesce((nullif(current_setting('request.headers', true),'')::json)->>'x-forwarded-for',''), ',', 1), ''); n int; s public.gx_admin_secrets; good boolean;
begin
  select count(*) into n from public.gx_admin_attempts where kind='gate' and ok=false and created_at > now() - interval '15 minutes' and (ip = v_ip or ip is null);
  if n >= 6 then return false; end if;
  select * into s from public.gx_admin_secrets where name='gate';
  good := found and encode(digest(s.salt || coalesce(p_code,''), 'sha256'), 'hex') = s.hash;
  insert into public.gx_admin_attempts(kind,user_id,ip,ok) values ('gate', auth.uid(), v_ip, good);
  if not good then insert into public.gx_security_events(kind,severity,detail) values ('admin_gate_fail',2,jsonb_build_object('ip',v_ip)); end if;
  return good;
end $$;

create or replace function public.gx_admin_unlock(p_key text) returns text language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid := auth.uid(); n int; s public.gx_admin_secrets; good boolean; tok text;
begin
  if uid is null or not exists (select 1 from public.gx_admins where user_id=uid) then
    insert into public.gx_security_events(kind,severity,user_id,detail) values ('admin_unlock_denied',3,uid,'{}'::jsonb); return null; end if;
  select count(*) into n from public.gx_admin_attempts where kind='key' and ok=false and user_id=uid and created_at > now() - interval '15 minutes';
  if n >= 5 then return null; end if;
  select * into s from public.gx_admin_secrets where name='key';
  good := found and encode(digest(s.salt || coalesce(p_key,''), 'sha256'), 'hex') = s.hash;
  insert into public.gx_admin_attempts(kind,user_id,ok) values ('key', uid, good);
  if not good then insert into public.gx_security_events(kind,severity,user_id,detail) values ('admin_key_fail',3,uid,'{}'::jsonb); return null; end if;
  delete from public.gx_admin_sessions where expires_at < now() or user_id=uid;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into public.gx_admin_sessions(token_hash,user_id,expires_at) values (encode(digest(tok,'sha256'),'hex'), uid, now() + interval '30 minutes');
  insert into public.gx_security_events(kind,severity,user_id,detail) values ('admin_login',1,uid,'{}'::jsonb);
  return tok;
end $$;

create or replace function public.gx_admin_check(p_token text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.gx_admins where user_id=uid) or
     not exists (select 1 from public.gx_admin_sessions where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and user_id=uid and expires_at>now())
  then raise exception 'denied'; end if;
  return uid;
end $$;

create or replace function public.gx_admin_logout(p_token text) returns void language plpgsql security definer set search_path=public,extensions as $$
begin delete from public.gx_admin_sessions where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and user_id=auth.uid(); end $$;

create or replace function public.gx_admin_overview(p_token text) returns json language plpgsql security definer set search_path=public,extensions as $$
begin
  perform public.gx_admin_check(p_token);
  return json_build_object(
    'users',(select count(*) from public.profiles),
    'developers',(select count(*) from public.profiles where role in ('developer','owner')),
    'apps',(select count(*) from public.apps where status='published'),
    'downloads',(select coalesce(sum(downloads),0) from public.apps),
    'comments',(select count(*) from public.app_comments),
    'hidden_comments',(select count(*) from public.app_comments where hidden),
    'reports',(select count(*) from public.app_comment_reports),
    'events_24h',(select count(*) from public.gx_security_events where created_at > now() - interval '24 hours' and kind not in ('admin_login')),
    'banned',(select count(*) from public.gx_user_flags where banned),
    'muted',(select count(*) from public.gx_user_flags where muted_until > now()));
end $$;

create or replace function public.gx_admin_users(p_token text, p_q text default '') returns json language plpgsql security definer set search_path=public,extensions as $$
declare r json;
begin
  perform public.gx_admin_check(p_token);
  select coalesce(json_agg(t), '[]'::json) into r from (
    select p.id, p.username, p.display_name, p.role, p.created_at, u.email, u.last_sign_in_at,
           coalesce(f.banned,false) as banned, coalesce(f.strikes,0) as strikes, f.muted_until,
           (select count(*) from public.apps a where a.developer_id=p.id) as apps,
           (select count(*) from public.app_comments c where c.user_id=p.id) as comments
    from public.profiles p join auth.users u on u.id=p.id left join public.gx_user_flags f on f.user_id=p.id
    where coalesce(p_q,'')='' or p.username ilike '%'||p_q||'%' or p.display_name ilike '%'||p_q||'%' or u.email ilike '%'||p_q||'%'
    order by p.created_at desc limit 100) t;
  return r;
end $$;

create or replace function public.gx_admin_apps(p_token text) returns json language plpgsql security definer set search_path=public,extensions as $$
declare r json;
begin
  perform public.gx_admin_check(p_token);
  select coalesce(json_agg(t), '[]'::json) into r from (
    select a.id, a.name, a.status, a.category, a.downloads, a.created_at, a.updated_at, p.display_name, p.username,
           (select count(*) from public.app_releases x where x.app_id=a.id) as releases,
           (select max(version_name) from public.app_releases x where x.app_id=a.id) as version,
           (select count(*) from public.app_reviews x where x.app_id=a.id) as ratings,
           (select round(avg(rating)::numeric,1) from public.app_reviews x where x.app_id=a.id) as rating
    from public.apps a left join public.profiles p on p.id=a.developer_id order by a.downloads desc, a.created_at desc limit 100) t;
  return r;
end $$;

create or replace function public.gx_admin_set_app_status(p_token text, p_app uuid, p_status text) returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  perform public.gx_admin_check(p_token);
  if p_status not in ('published','suspended') then raise exception 'bad status'; end if;
  update public.apps set status=p_status where id=p_app;
  insert into public.gx_security_events(kind,severity,user_id,detail) values ('admin_app_status',1,auth.uid(),jsonb_build_object('app_id',p_app,'status',p_status));
end $$;

create or replace function public.gx_admin_comments(p_token text, p_flagged boolean default false) returns json language plpgsql security definer set search_path=public,extensions as $$
declare r json;
begin
  perform public.gx_admin_check(p_token);
  select coalesce(json_agg(t), '[]'::json) into r from (
    select c.id, c.body, c.hidden, c.created_at, c.user_id, p.display_name, p.username, a.name as app_name,
           (select count(*) from public.app_comment_reports x where x.comment_id=c.id) as reports
    from public.app_comments c join public.profiles p on p.id=c.user_id join public.apps a on a.id=c.app_id
    where not p_flagged or c.hidden or exists (select 1 from public.app_comment_reports x where x.comment_id=c.id)
    order by c.created_at desc limit 100) t;
  return r;
end $$;

create or replace function public.gx_admin_comment_action(p_token text, p_id uuid, p_action text) returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  perform public.gx_admin_check(p_token);
  if p_action='hide' then update public.app_comments set hidden=true where id=p_id;
  elsif p_action='show' then update public.app_comments set hidden=false where id=p_id;
  elsif p_action='delete' then delete from public.app_comments where id=p_id;
  else raise exception 'bad action'; end if;
end $$;

create or replace function public.gx_admin_user_action(p_token text, p_user uuid, p_action text, p_reason text default null) returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  perform public.gx_admin_check(p_token);
  if exists (select 1 from public.gx_admins where user_id=p_user) then raise exception 'cannot moderate admin'; end if;
  insert into public.gx_user_flags(user_id) values (p_user) on conflict do nothing;
  if p_action='ban' then update public.gx_user_flags set banned=true, ban_reason=left(coalesce(p_reason,''),200), updated_at=now() where user_id=p_user;
  elsif p_action='unban' then update public.gx_user_flags set banned=false, ban_reason=null, updated_at=now() where user_id=p_user;
  elsif p_action='mute' then update public.gx_user_flags set muted_until=now()+interval '1 day', updated_at=now() where user_id=p_user;
  elsif p_action='unmute' then update public.gx_user_flags set muted_until=null, updated_at=now() where user_id=p_user;
  elsif p_action='reset' then update public.gx_user_flags set strikes=0, muted_until=null, updated_at=now() where user_id=p_user;
  else raise exception 'bad action'; end if;
  insert into public.gx_security_events(kind,severity,user_id,detail) values ('admin_user_action',1,auth.uid(),jsonb_build_object('target',p_user,'action',p_action));
end $$;

create or replace function public.gx_admin_events(p_token text) returns json language plpgsql security definer set search_path=public,extensions as $$
declare r json;
begin
  perform public.gx_admin_check(p_token);
  select coalesce(json_agg(t), '[]'::json) into r from (
    select e.id, e.kind, e.severity, e.user_id, e.detail, e.created_at, p.display_name, p.username
    from public.gx_security_events e left join public.profiles p on p.id=e.user_id order by e.created_at desc limit 100) t;
  return r;
end $$;

create or replace function public.gx_admin_words(p_token text) returns json language plpgsql security definer set search_path=public,extensions as $$
declare r json;
begin
  perform public.gx_admin_check(p_token);
  select coalesce(json_agg(t), '[]'::json) into r from (select word, severity from public.gx_banned_words order by severity desc, word) t;
  return r;
end $$;

create or replace function public.gx_admin_word_set(p_token text, p_word text, p_sev int, p_remove boolean default false) returns void language plpgsql security definer set search_path=public,extensions as $$
begin
  perform public.gx_admin_check(p_token);
  if p_remove then delete from public.gx_banned_words where word=p_word;
  else insert into public.gx_banned_words(word,severity) values (btrim(lower(p_word)), case when p_sev=2 then 2 else 1 end) on conflict (word) do update set severity=excluded.severity; end if;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'gx\_admin\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = 'gx_admin_gate' then execute format('grant execute on function %s to anon, authenticated', f.sig);
    elsif f.proname <> 'gx_admin_check' then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;

insert into public.gx_admins(user_id)
  select id from auth.users where lower(email) = lower('gx.developer.11@gmail.com')
on conflict do nothing;
