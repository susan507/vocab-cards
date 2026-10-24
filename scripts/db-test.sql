insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@vocab-cards.local', '{"name": " Ana "}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@vocab-cards.local', null);
insert into public.topic_marks (user_id, kind, topic_key) values ('00000000-0000-0000-0000-00000000000b', 'star', 'b-topic');

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

do $$
begin
  assert (select count(*) from public.profiles) = 1, 'sees only own profile';
  assert (select settings ->> 'theme' from public.profiles) = 'dark', 'updates own settings';
  assert (select string_agg(kind || ':' || topic_key, ',') from public.topic_marks) = 'star:a-topic', 'sees only own marks';
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
end $$;

set role anon;
set request.jwt.claim.sub = '';
do $$
declare t text;
begin
  foreach t in array array['profiles', 'topic_marks', 'word_progress'] loop
    begin
      execute format('select 1 from public.%I', t);
      raise exception 'anon can read %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
