create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text unique not null check (name = lower(btrim(name)) and length(name) between 1 and 30),
  settings jsonb not null default '{}' check (pg_column_size(settings) <= 8192),
  created_at timestamptz not null default now()
);

create table public.topic_marks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('star', 'done')),
  topic_key text not null check (length(topic_key) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, topic_key)
);

create table public.word_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id text not null check (length(word_id) between 1 and 200),
  data jsonb not null default '{}' check (pg_column_size(data) <= 8192),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

alter table public.profiles enable row level security;
alter table public.topic_marks enable row level security;
alter table public.word_progress enable row level security;

revoke all on public.profiles, public.topic_marks, public.word_progress from anon, authenticated;
-- Profiles are created by the trigger below; users may only change their settings.
grant select, update (settings) on public.profiles to authenticated;
grant select, insert, update, delete on public.topic_marks, public.word_progress to authenticated;

create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own marks" on public.topic_marks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own progress" on public.word_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, lower(btrim(coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
