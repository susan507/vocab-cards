insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@vocab-cards.local', '{"name": " Ana "}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@vocab-cards.local', null);
insert into public.topic_marks (user_id, kind, topic_key) values ('00000000-0000-0000-0000-00000000000b', 'star', 'b-topic');
insert into public.private_books (user_id, book_id, data) values ('00000000-0000-0000-0000-00000000000b', 'b-book', '{"title": "B"}');

do $$
begin
  assert (select string_agg(name, ',' order by name) from public.profiles) = 'ana,bob', 'trigger creates normalized profiles';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into public.topic_marks (kind, topic_key) values ('star', 'a-topic'), ('done', 'a-topic');
delete from public.topic_marks where kind = 'done';
update public.profiles set settings = settings || '{"theme": "dark"}';
update public.topic_marks set topic_key = 'hacked' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.topic_marks where user_id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set settings = '{"x": 1}' where id = '00000000-0000-0000-0000-00000000000b';
insert into public.private_books (book_id, data) values ('a-book', '{"title": "A"}'), ('a-gone', '{}');
insert into public.private_books (book_id, data) values ('a-book', '{"title": "A2"}')
  on conflict (user_id, book_id) do update set data = excluded.data;
delete from public.private_books where book_id = 'a-gone';
update public.private_books set data = '{"title": "hacked"}' where book_id = 'b-book';
delete from public.private_books where book_id = 'b-book';

do $$
begin
  assert (select count(*) from public.profiles) = 1, 'sees only own profile';
  assert (select settings ->> 'theme' from public.profiles) = 'dark', 'updates own settings';
  assert (select string_agg(kind || ':' || topic_key, ',') from public.topic_marks) = 'star:a-topic', 'sees only own marks';
  assert (select string_agg(book_id || ':' || (data ->> 'title'), ',') from public.private_books) = 'a-book:A2', 'sees and upserts only own books';
  begin
    insert into public.private_books (user_id, book_id, data) values ('00000000-0000-0000-0000-00000000000b', 'x', '{}');
    raise exception 'inserted a book for another user';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.private_books (book_id, data) values ('Bad/Id', '{}');
    raise exception 'accepted bad book id';
  exception when check_violation then null;
  end;
  begin
    insert into public.topic_marks (user_id, kind, topic_key) values ('00000000-0000-0000-0000-00000000000b', 'star', 'x');
    raise exception 'inserted a mark for another user';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set name = 'eve';
    raise exception 'renamed profile';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.topic_marks (kind, topic_key) values ('nope', 'x');
    raise exception 'accepted bad kind';
  exception when check_violation then null;
  end;
end $$;

reset role;
do $$
begin
  assert (select topic_key from public.topic_marks where user_id = '00000000-0000-0000-0000-00000000000b') = 'b-topic', 'B mark untouched';
  assert (select settings from public.profiles where name = 'bob') = '{}', 'B settings untouched';
  assert (select data ->> 'title' from public.private_books where book_id = 'b-book') = 'B', 'B book untouched';
end $$;

set role anon;
set request.jwt.claim.sub = '';
do $$
declare t text;
begin
  foreach t in array array['profiles', 'topic_marks', 'word_progress', 'private_books'] loop
    begin
      execute format('select 1 from public.%I', t);
      raise exception 'anon can read %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
