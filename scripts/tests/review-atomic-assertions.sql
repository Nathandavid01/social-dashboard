\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('test.actor','00000000-0000-0000-0000-000000000001',true);
select public.commit_internal_review('00000000-0000-0000-0000-000000000010','approve','00000000-0000-0000-0000-000000000020',null,true,true);
do $$ begin
 if (select approval_status from content_ideas limit 1)<>'approved' or (select count(*) from content_idea_activity)<>1 then raise exception 'approval and history not saved';end if;
 begin
  perform public.commit_internal_review('00000000-0000-0000-0000-000000000010','request_changes',null,'stale review',false,false);
  raise exception 'stale decision allowed';
 exception when sqlstate 'P0002' then null; end;
 if (select count(*) from content_idea_activity)<>1 then raise exception 'stale history persisted';end if;
end $$;
rollback;
begin;
alter table content_idea_activity add constraint simulate_write_failure check(false) not valid;
set local role authenticated;
select set_config('test.actor','00000000-0000-0000-0000-000000000001',true);
do $$ begin
 begin
  perform public.commit_internal_review('00000000-0000-0000-0000-000000000010','approve','00000000-0000-0000-0000-000000000020',null,true,true);
  raise exception 'activity failure ignored';
 exception when check_violation then null; end;
 if (select approval_status from content_ideas limit 1)<>'submitted' then raise exception 'status changed despite history failure';end if;
end $$;
rollback;
begin;
set local role authenticated;
select set_config('test.actor','00000000-0000-0000-0000-000000000002',true);
do $$ begin
 begin
  perform public.commit_internal_review('00000000-0000-0000-0000-000000000010','approve','00000000-0000-0000-0000-000000000020',null,true,true);
  raise exception 'editor self approval allowed';
 exception when insufficient_privilege then null;end;
end $$;
rollback;
