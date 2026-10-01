-- Run this in the Supabase SQL Editor for project dcyrvcdilspkohritbek.
-- Requires player_leaderboard (see leaderboard.sql) to already exist.

create table if not exists public.oblivion_relic (
    id smallint primary key default 1,
    claimed_by text,
    claimed_at timestamptz,
    total_attempts bigint not null default 0,
    constraint oblivion_relic_single_row check (id = 1)
);

insert into public.oblivion_relic (id) values (1) on conflict (id) do nothing;

alter table public.oblivion_relic enable row level security;

grant select on public.oblivion_relic to anon, authenticated;
revoke insert, update, delete on public.oblivion_relic from anon, authenticated;

drop policy if exists "Oblivion relic status is public" on public.oblivion_relic;
create policy "Oblivion relic status is public"
    on public.oblivion_relic for select
    to anon, authenticated
    using (true);

-- The database rolls the chance and atomically awards the relic to the first
-- winner. The legacy p_won parameter is ignored so older clients cannot force
-- a win. This runs as the function owner (bypassing RLS), keeping direct
-- client writes locked down.
create or replace function public.attempt_oblivion_relic(p_won boolean)
returns table(claimed_by text, claimed_at timestamptz, total_attempts bigint, won_claim boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_username text;
    v_rows int := 0;
    v_won_claim boolean := false;
begin
    select username into v_username from public.player_leaderboard where user_id = auth.uid();
    if v_username is null then
        raise exception 'You must claim a leaderboard username before opening the Oblivion Case.';
    end if;

    update public.oblivion_relic
    set total_attempts = total_attempts + 1
    where id = 1;

    if random() < 1.0 / 100000000.0 then
        update public.oblivion_relic
        set claimed_by = v_username, claimed_at = now()
        where id = 1 and claimed_by is null;

        get diagnostics v_rows = row_count;
        v_won_claim := v_rows > 0;
    end if;

    return query
        select o.claimed_by, o.claimed_at, o.total_attempts, v_won_claim
        from public.oblivion_relic o
        where o.id = 1;
end;
$$;

grant execute on function public.attempt_oblivion_relic(boolean) to authenticated;
