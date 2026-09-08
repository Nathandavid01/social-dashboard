begin;
do $$declare result jsonb;begin
 result:=submit_entregas_review(uid(2),uid(4),'rejected','Recortar inicio','Test');
 if result->>'ok'<>'true' then raise exception 'rejection failed';end if;
 if (select approval_status from content_ideas where id=uid(4))<>'revision_needed' then raise exception 'not returned';end if;
 if not exists(select 1 from content_idea_activity where metadata->>'note'='Recortar inicio' and metadata->>'cliente'='Test') then raise exception 'missing comment';end if;
 result:=submit_entregas_review(uid(2),uid(4),'approved','','Test');
 if result->>'error'<>'ya_votado' then raise exception 'vote overwritten';end if;
 if (select count(*) from content_idea_activity)<>1 then raise exception 'duplicate history';end if;
end$$;
rollback;
begin;
create function fail_public_history() returns trigger language plpgsql as $$begin raise exception 'injected history failure';end$$;
create trigger fail_history before insert on content_idea_activity for each row execute function fail_public_history();
do $$begin
 begin
  perform submit_entregas_review(uid(2),uid(4),'rejected','Recortar inicio','Test');
  raise exception 'expected injected error';
 exception when others then if sqlerrm<>'injected history failure' then raise;end if;end;
 if (select status from entregas_client_review_items where id=uid(3))<>'pending' then raise exception 'vote not rolled back';end if;
 if (select approval_status from content_ideas where id=uid(4))<>'approved' then raise exception 'idea not rolled back';end if;
end$$;
rollback;
