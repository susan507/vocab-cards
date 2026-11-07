-- In-progress study sessions per deck and direction, so a session started on one device resumes on another.
-- `data` is the app's saved envelope; a finished session stays as a tombstone (`data.data` null).
create table public.study_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_key text not null check (length(session_key) between 1 and 300),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 1048576),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_key)
);

alter table public.study_sessions enable row level security;

revoke all on public.study_sessions from anon, authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;

create policy "own sessions" on public.study_sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
