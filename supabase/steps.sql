-- Steps tracking (optional feature). Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. Does not touch any existing table or data.

-- 1. Steps per hour (from the iPhone "Shortcuts" automation). Hourly so every hour can be assigned
--    to the right logical day according to the user's day-reset time.
create table if not exists public.step_hours (
    user_id    uuid        not null references auth.users(id) on delete cascade,
    hour_start timestamptz not null,
    steps      integer     not null check (steps >= 0 and steps <= 60000),
    updated_at timestamptz not null default now(),
    primary key (user_id, hour_start)
);
alter table public.step_hours enable row level security;
drop policy if exists "step_hours read own" on public.step_hours;
create policy "step_hours read own" on public.step_hours for select using (auth.uid() = user_id);
drop policy if exists "step_hours delete own" on public.step_hours;
create policy "step_hours delete own" on public.step_hours for delete using (auth.uid() = user_id);

-- 2. Personal "steps key" used by the iPhone shortcut. It can ONLY write steps for its owner.
create table if not exists public.step_tokens (
    user_id      uuid        primary key references auth.users(id) on delete cascade,
    token        text        not null unique,
    created_at   timestamptz not null default now(),
    last_used_at timestamptz
);
alter table public.step_tokens enable row level security;
drop policy if exists "step_tokens read own" on public.step_tokens;
create policy "step_tokens read own" on public.step_tokens for select using (auth.uid() = user_id);

-- 3. Get (or create) the logged-in user's steps key
create or replace function public.get_steps_token(p_regenerate boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
    v_user  uuid := auth.uid();
    v_token text;
begin
    if v_user is null then raise exception 'not authenticated'; end if;
    select token into v_token from step_tokens where user_id = v_user;
    if v_token is null or p_regenerate then
        v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        insert into step_tokens (user_id, token) values (v_user, v_token)
        on conflict (user_id) do update set token = excluded.token, created_at = now(), last_used_at = null;
    end if;
    return v_token;
end $$;
revoke all on function public.get_steps_token(boolean) from public, anon;
grant execute on function public.get_steps_token(boolean) to authenticated;

-- 4. Save hourly steps sent by the shortcut. p_hours = [{"start": "2026-11-11T21:00:00+02:00", "steps": 840}, ...]
--    Only hours from the last 7 days are accepted; an hour sent again replaces its old value.
create or replace function public.submit_steps(p_token text, p_hours jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
    v_user  uuid;
    v_count integer := 0;
    v_item  jsonb;
    v_hour  timestamptz;
    v_steps integer;
begin
    select user_id into v_user from step_tokens where token = p_token;
    if v_user is null then raise exception 'invalid steps key' using errcode = '28000'; end if;
    if jsonb_typeof(p_hours) <> 'array' then raise exception 'bad data'; end if;

    for v_item in select * from jsonb_array_elements(p_hours) loop
        begin
            v_hour  := date_trunc('hour', (v_item->>'start')::timestamptz);
            v_steps := round((v_item->>'steps')::numeric);
        exception when others then
            continue; -- skip a malformed line instead of failing the whole upload
        end;
        if v_hour < now() - interval '7 days' or v_hour > now() + interval '1 hour' then continue; end if;
        if v_steps < 0 or v_steps > 60000 then continue; end if;
        insert into step_hours (user_id, hour_start, steps, updated_at) values (v_user, v_hour, v_steps, now())
        on conflict (user_id, hour_start) do update set steps = excluded.steps, updated_at = now();
        v_count := v_count + 1;
    end loop;

    update step_tokens set last_used_at = now() where user_id = v_user;
    return v_count;
end $$;
revoke all on function public.submit_steps(text, jsonb) from public;
grant execute on function public.submit_steps(text, jsonb) to anon, authenticated;
