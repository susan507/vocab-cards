-- Books a user imported from a file (e.g. from a paid source): visible only to their owner.
create table public.private_books (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id text not null check (book_id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 5242880),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.private_books enable row level security;

revoke all on public.private_books from anon, authenticated;
grant select, insert, update, delete on public.private_books to authenticated;

create policy "own books" on public.private_books for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
