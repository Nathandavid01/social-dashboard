set test.actor='00000000-0000-0000-0000-000000000001';
begin;
do $$declare first_token text; second_token text; begin
 first_token:=replace_client_review_link(uid(10),array[uid(20)],uid(50))->>'token';
 second_token:=replace_client_review_link(uid(10),array[uid(20)],uid(50))->>'token';
 if first_token is null or first_token<>second_token then raise exception 'Idempotency failed';end if;
 if (select count(*) from entregas_client_review_items where idea_id=uid(20))<>1 then raise exception 'duplicate link';end if;
 if not exists(select 1 from entregas_client_review_items where idea_id=uid(21) and review_id=uid(40)) then raise exception 'sibling lost';end if;
end$$;
rollback;
begin;
create function fail_link_delete() returns trigger language plpgsql as $$begin raise exception 'injected failure';end$$;
create trigger fail_delete before delete on entregas_client_review_items for each row execute function fail_link_delete();
do $$begin
 begin
  perform replace_client_review_link(uid(10),array[uid(20)],uid(50));
  raise exception 'Expected injected failure';
 exception when others then
  if sqlerrm<>'injected failure' then raise;end if;
 end;
 if exists(select 1 from entregas_client_reviews where id=uid(50)) then raise exception 'new link was not rolled back';end if;
 if (select count(*) from entregas_client_review_items where review_id=uid(40))<>2 then raise exception 'old link was lost';end if;
end$$;
rollback;
begin;
do $$begin
 begin perform replace_client_review_link(uid(10),array[uid(22)],uid(50));raise exception 'expected validation';exception when invalid_parameter_value then null;end;
 perform set_config('test.actor',uid(2)::text,true);
 begin perform replace_client_review_link(uid(10),array[uid(20)],uid(50));raise exception 'expected permission';exception when insufficient_privilege then null;end;
end$$;
rollback;
begin;
set local role authenticated;
do $$begin
 perform replace_client_review_link(uid(10),array[uid(20)],uid(50));
 perform replace_client_review_link(uid(10),array[uid(20)],uid(51));
 begin perform replace_client_review_link(uid(10),array[uid(20)],uid(50));raise exception 'expected stale request rejection';exception when invalid_parameter_value then null;end;
 if (select count(*) from entregas_client_review_items where idea_id=uid(20))<>1 then raise exception 'superseded replay created another link';end if;
end$$;
rollback;
