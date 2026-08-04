create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_handle text not null,
  display_name text,
  avatar_url text,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_accounts (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  text text not null check (length(trim(text)) > 0),
  emotion text not null default '喜悦',
  is_public boolean not null default false,
  author text not null default '匿名',
  created_at timestamptz not null default now()
);

create table if not exists public.dream_likes (
  dream_id uuid not null references public.dreams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dream_id, user_id)
);

create table if not exists public.dream_comments (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null references public.dreams(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 240),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.get_dream_interaction_counts(dream_ids uuid[])
returns table(dream_id uuid, like_count bigint, comment_count bigint)
language sql
stable
set search_path = public
as $$
  select
    dreams.id as dream_id,
    count(distinct dream_likes.user_id) as like_count,
    count(distinct dream_comments.id) as comment_count
  from public.dreams
  left join public.dream_likes on public.dream_likes.dream_id = public.dreams.id
  left join public.dream_comments on public.dream_comments.dream_id = public.dreams.id
  where public.dreams.id = any(dream_ids)
  group by public.dreams.id
$$;

create unique index if not exists profiles_public_handle_idx on public.profiles (public_handle);
create unique index if not exists user_accounts_email_idx on public.user_accounts (lower(email));
create index if not exists dreams_user_created_at_idx on public.dreams (user_id, created_at desc);
create index if not exists dreams_created_at_idx on public.dreams (created_at desc);
create index if not exists dreams_public_created_at_idx on public.dreams (is_public, created_at desc);
create index if not exists dreams_emotion_idx on public.dreams (emotion);
create index if not exists dream_likes_user_created_at_idx on public.dream_likes (user_id, created_at desc);
create index if not exists dream_comments_dream_created_at_idx on public.dream_comments (dream_id, created_at asc);
create index if not exists dream_comments_user_created_at_idx on public.dream_comments (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_accounts enable row level security;
alter table public.dreams enable row level security;
alter table public.dream_likes enable row level security;
alter table public.dream_comments enable row level security;

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
drop policy if exists "Dream likes are readable" on public.dream_likes;
drop policy if exists "Users can like visible dreams" on public.dream_likes;
drop policy if exists "Users can remove own likes" on public.dream_likes;
drop policy if exists "Dream comments are readable" on public.dream_comments;
drop policy if exists "Users can comment on visible dreams" on public.dream_comments;
drop policy if exists "Users can update own comments" on public.dream_comments;
drop policy if exists "Users can remove own comments" on public.dream_comments;
drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Users can upload own avatars" on storage.objects;
drop policy if exists "Users can update own avatars" on storage.objects;
drop policy if exists "Users can delete own avatars" on storage.objects;

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

create policy "Dream likes are readable"
on public.dream_likes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.dreams
    where public.dreams.id = public.dream_likes.dream_id
      and (public.dreams.is_public = true or public.dreams.user_id = auth.uid())
  )
);

create policy "Users can like visible dreams"
on public.dream_likes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.dreams
    where public.dreams.id = public.dream_likes.dream_id
      and (public.dreams.is_public = true or public.dreams.user_id = auth.uid())
  )
);

create policy "Users can remove own likes"
on public.dream_likes
for delete
to authenticated
using (auth.uid() = user_id);

grant select on public.dream_likes to anon, authenticated;
grant insert, delete on public.dream_likes to authenticated;

create policy "Dream comments are readable"
on public.dream_comments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.dreams
    where public.dreams.id = public.dream_comments.dream_id
      and (public.dreams.is_public = true or public.dreams.user_id = auth.uid())
  )
);

create policy "Users can comment on visible dreams"
on public.dream_comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and length(trim(body)) between 1 and 240
  and exists (
    select 1
    from public.dreams
    where public.dreams.id = public.dream_comments.dream_id
      and (public.dreams.is_public = true or public.dreams.user_id = auth.uid())
  )
);

create policy "Users can update own comments"
on public.dream_comments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and length(trim(body)) between 1 and 240);

create policy "Users can remove own comments"
on public.dream_comments
for delete
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.dreams
    where public.dreams.id = public.dream_comments.dream_id
      and public.dreams.user_id = auth.uid()
  )
);

grant select on public.dream_comments to anon, authenticated;
grant insert, update, delete on public.dream_comments to authenticated;
grant execute on function public.get_dream_interaction_counts(uuid[]) to anon, authenticated;

create policy "Avatar images are publicly readable"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "Users can upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
