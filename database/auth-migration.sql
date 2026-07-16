create extension if not exists pgcrypto;

alter table public.dreams
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.dreams
  alter column emotion set default '喜悦',
  alter column author set default '匿名';

create index if not exists dreams_user_created_at_idx on public.dreams (user_id, created_at desc);
create index if not exists dreams_created_at_idx on public.dreams (created_at desc);
create index if not exists dreams_public_created_at_idx on public.dreams (is_public, created_at desc);
create index if not exists dreams_emotion_idx on public.dreams (emotion);

alter table public.dreams enable row level security;

drop policy if exists "Public dreams are readable" on public.dreams;
drop policy if exists "Users can read own dreams" on public.dreams;
drop policy if exists "Users can insert own dreams" on public.dreams;
drop policy if exists "Users can update own dreams" on public.dreams;
drop policy if exists "Users can delete own dreams" on public.dreams;

create policy "Public dreams are readable"
on public.dreams
for select
to anon, authenticated
using (is_public = true);

create policy "Users can read own dreams"
on public.dreams
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own dreams"
on public.dreams
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own dreams"
on public.dreams
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own dreams"
on public.dreams
for delete
to authenticated
using (auth.uid() = user_id);
