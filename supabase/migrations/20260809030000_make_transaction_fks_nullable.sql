-- Create the mileage_entries table (mirrors schema.ts MIGRATIONS)
-- The initial 20240727 migration was applied to the cloud BEFORE mileage
-- was added, so this table was missing from the remote DB.

create table if not exists public.mileage_entries (
    id              text primary key not null,
    user_id         text not null,
    date            text not null,
    purpose         text not null default 'Business',
    miles           real not null default 0,
    start_lat       real,
    start_lng       real,
    start_location  text,
    end_lat         real,
    end_lng         real,
    end_location    text,
    created_at      text not null,
    updated_at      text not null
);

create index if not exists idx_mileage_entries_user_id on public.mileage_entries(user_id);
create index if not exists idx_mileage_entries_date on public.mileage_entries(date);

-- RLS: only the owning user can access their mileage entries
alter table public.mileage_entries enable row level security;

create policy "Allow individual reads on mileage_entries"
    on public.mileage_entries for select
    using (auth.uid()::text = user_id);

create policy "Allow individual inserts on mileage_entries"
    on public.mileage_entries for insert
    with check (auth.uid()::text = user_id);

create policy "Allow individual updates on mileage_entries"
    on public.mileage_entries for update
    using (auth.uid()::text = user_id)
    with check (auth.uid()::text = user_id);

create policy "Allow individual deletes on mileage_entries"
    on public.mileage_entries for delete
    using (auth.uid()::text = user_id);

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.mileage_entries to anon, authenticated, service_role;
