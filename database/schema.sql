create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  public_handle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  emotion text not null default '喜悦',
  is_public boolean not null default false,
  author text not null default '匿名',
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_public_handle_idx on public.profiles (public_handle);
create index if not exists dreams_user_created_at_idx on public.dreams (user_id, created_at desc);
create index if not exists dreams_created_at_idx on public.dreams (created_at desc);
create index if not exists dreams_public_created_at_idx on public.dreams (is_public, created_at desc);
create index if not exists dreams_emotion_idx on public.dreams (emotion);

alter table public.profiles enable row level security;
alter table public.dreams enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Public dreams are readable" on public.dreams;
drop policy if exists "Users can read own dreams" on public.dreams;
drop policy if exists "Users can insert own dreams" on public.dreams;
drop policy if exists "Users can update own dreams" on public.dreams;
drop policy if exists "Users can delete own dreams" on public.dreams;

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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
