begin;
select set_config('test.actor',uid(1)::text,true);
do $$begin
 perform set_client_editors(uid(10),array[uid(2),uid(3)]);
 if (select count(*) from client_editor_assignments where client_id=uid(10))<>2 then raise exception 'missing editor links';end if;
 if (select client_id from recording_sessions where id=uid(20)) is not null then raise exception 'changed recording while assigning client';end if;
 if (select assigned_to from clients where id=uid(10)) is distinct from uid(2) then raise exception 'primary changed';end if;
 begin
  perform set_client_editors(uid(10),array[uid(4)]);
  raise exception 'invalid editor accepted';
 exception when invalid_parameter_value then null;end;
 if (select count(*) from client_editor_assignments where client_id=uid(10))<>2 then raise exception 'failed update lost assignments';end if;
 perform set_client_editors(uid(10),array[uid(3)]);
 if (select assigned_to from clients where id=uid(10)) is distinct from uid(3) then raise exception 'primary not replaced';end if;
 if (select count(*) from client_editor_assignments where client_id=uid(10))<>1 then raise exception 'removed editor retained';end if;
end$$;
select set_config('test.actor',uid(3)::text,true);
do $$begin
 begin
  perform set_client_editors(uid(10),array[uid(2)]);
  raise exception 'editor could assign';
 exception when insufficient_privilege then null;end;
end$$;
rollback;
begin;
select set_config('test.actor',uid(1)::text,true);
select set_client_editors(uid(10),array[uid(2),uid(3)]);
insert into clients values(uid(11),null,null,null);
insert into content_ideas values(uid(30),uid(10),uid(20)),(uid(31),uid(11),null);
insert into content_idea_videos values(uid(40),uid(30)),(uid(41),uid(31));
alter table clients enable row level security;
alter table content_ideas enable row level security;
alter table content_idea_videos enable row level security;
grant usage on schema auth to authenticated;
grant select on profiles,clients,content_ideas,content_idea_videos to authenticated;
select set_config('test.actor',uid(3)::text,true);
set local role authenticated;
do $$begin
 if (select count(*) from clients)<>1 then raise exception 'secondary editor client scope wrong';end if;
 if (select count(*) from content_ideas)<>1 then raise exception 'secondary editor idea scope wrong';end if;
 if (select count(*) from content_idea_videos)<>1 then raise exception 'secondary editor media scope wrong';end if;
 if (select count(*) from client_editor_assignments)<>1 then raise exception 'membership privacy wrong';end if;
end$$;
reset role;
-- Changing the legacy primary assignment must not retain the removed editor.
update clients set assigned_to=uid(3) where id=uid(10);
do $$begin
 if exists(select 1 from client_editor_assignments where client_id=uid(10) and editor_id=uid(2)) then raise exception 'old primary retained';end if;
end$$;
rollback;
