create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_handle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_accounts (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop view if exists public.profile_handles;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    execute $copy$
      insert into public.user_accounts (user_id, email)
      select user_id, email
      from public.profiles
      where email is not null and trim(email) <> ''
      on conflict (user_id) do nothing
    $copy$;
  end if;
end $$;

alter table public.profiles
  drop column if exists email,
  add column if not exists public_handle text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists signature text;

update public.profiles
set public_handle = 'unique' || substr(replace(user_id::text, '-', ''), 1, 10)
where public_handle is null or trim(public_handle) = '';

alter table public.profiles
  alter column public_handle set not null;

alter table public.dreams
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.dreams
  alter column emotion set default '喜悦',
  alter column author set default '匿名';

insert into public.profiles (user_id, public_handle)
select
  id,
  'unique' || substr(replace(id::text, '-', ''), 1, 10)
from auth.users
on conflict (user_id) do nothing;

update public.dreams
set author = 'unique' || lpad(((abs(hashtext(coalesce(user_id::text, id::text))) % 900000) + 100000)::text, 6, '0')
where author ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dreams_user_profile_fkey'
      and conrelid = 'public.dreams'::regclass
  ) then
    alter table public.dreams
      add constraint dreams_user_profile_fkey
      foreign key (user_id)
      references public.profiles(user_id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists profiles_public_handle_idx on public.profiles (public_handle);
create unique index if not exists user_accounts_email_idx on public.user_accounts (lower(email));
create index if not exists dreams_user_created_at_idx on public.dreams (user_id, created_at desc);
create index if not exists dreams_created_at_idx on public.dreams (created_at desc);
create index if not exists dreams_public_created_at_idx on public.dreams (is_public, created_at desc);
create index if not exists dreams_emotion_idx on public.dreams (emotion);

alter table public.profiles enable row level security;
alter table public.user_accounts enable row level security;
alter table public.dreams enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Profiles are readable" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own account" on public.user_accounts;
drop policy if exists "Users can insert own account" on public.user_accounts;
drop policy if exists "Users can update own account" on public.user_accounts;
drop policy if exists "Public dreams are readable" on public.dreams;
drop policy if exists "Users can read own dreams" on public.dreams;
drop policy if exists "Users can insert own dreams" on public.dreams;
drop policy if exists "Users can update own dreams" on public.dreams;
drop policy if exists "Users can delete own dreams" on public.dreams;

create policy "Profiles are readable"
on public.profiles
for select
to anon, authenticated
using (true);

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

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

create policy "Users can read own account"
on public.user_accounts
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own account"
on public.user_accounts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own account"
on public.user_accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.user_accounts to authenticated;

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
