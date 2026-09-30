-- Run this in the Supabase SQL Editor for project dcyrvcdilspkohritbek.
-- Enable Anonymous Sign-Ins under Authentication > Providers before launching the game.

create table if not exists public.player_leaderboard (
    user_id uuid primary key references auth.users (id) on delete cascade,
    username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
    score numeric not null default 0 check (score >= 0),
    rarest_axe_name text not null default 'Default Axe',
    rarest_axe_rarity text not null default 'Common',
    rarest_axe_rank integer not null default 0 check (rarest_axe_rank >= 0),
    total_chopped numeric not null default 0 check (total_chopped >= 0),
    rebirth integer not null default 0 check (rebirth >= 0),
    chickens integer not null default 0 check (chickens >= 0),
    updated_at timestamptz not null default now()
);

create unique index if not exists player_leaderboard_username_ci
    on public.player_leaderboard (lower(username));

alter table public.player_leaderboard enable row level security;

grant select on public.player_leaderboard to anon, authenticated;
grant insert, update on public.player_leaderboard to authenticated;
revoke delete, truncate on public.player_leaderboard from anon, authenticated;

create or replace function public.prevent_leaderboard_username_change()
returns trigger
language plpgsql
as $$
begin
    if lower(new.username) <> lower(old.username) then
        raise exception 'Player usernames cannot be changed or reused';
    end if;
    return new;
end;
$$;

drop trigger if exists player_leaderboard_username_immutable on public.player_leaderboard;
create trigger player_leaderboard_username_immutable
    before update of username on public.player_leaderboard
    for each row execute function public.prevent_leaderboard_username_change();

drop policy if exists "Leaderboard is public" on public.player_leaderboard;
create policy "Leaderboard is public"
    on public.player_leaderboard for select
    to anon, authenticated
    using (true);

drop policy if exists "Players register their own username" on public.player_leaderboard;
create policy "Players register their own username"
    on public.player_leaderboard for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Players update their own leaderboard row" on public.player_leaderboard;
create policy "Players update their own leaderboard row"
    on public.player_leaderboard for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
