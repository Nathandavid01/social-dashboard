begin;
do $$declare result jsonb;begin
 result:=get_entregas_review_v2(uid(2));
 if result#>>'{videos,0,video_file_id}' is distinct from uid(10)::text then raise exception 'missing file identity: %',result;end if;
end$$;
insert into content_idea_videos values(uid(11),uid(4),'edited','entregas-r2',null,'replacement.mp4',now()+interval '1 minute');
do $$declare result jsonb;begin
 result:=submit_entregas_review_v2(uid(2),uid(4),'approved','','Test',uid(10));
 if result->>'error' is distinct from 'video_cambio' then raise exception 'stale file approved: %',result;end if;
 if (select status from entregas_client_review_items where id=uid(3))<>'pending' then raise exception 'stale vote persisted';end if;
 result:=submit_entregas_review_v2(uid(2),uid(4),'approved','','Test',uid(11));
 if result->>'ok' is distinct from 'true' then raise exception 'current file rejected: %',result;end if;
 if (select video_file_id from entregas_client_review_items where id=uid(3)) is distinct from uid(11) then raise exception 'file not sealed';end if;
end$$;
insert into content_idea_videos values(uid(12),uid(4),'edited','entregas-r2',null,'third.mp4',now()+interval '2 minutes');
do $$declare result jsonb;begin
 result:=get_entregas_review_v2(uid(2));
 if result#>>'{videos,0,video_key}' is distinct from 'replacement.mp4' then raise exception 'voted file silently replaced: %',result;end if;
end$$;
rollback;
begin;
update content_idea_videos set status='failed';
do $$declare result jsonb;begin
 result:=get_entregas_review_v2(uid(2));
 if result#>>'{videos,0,video_key}' is not null then raise exception 'failed file exposed';end if;
 result:=submit_entregas_review_v2(uid(2),uid(4),'approved','','Test',uid(10));
 if result->>'error' is distinct from 'video_cambio' then raise exception 'failed file accepted: %',result;end if;
 result:=submit_entregas_review_v2(uid(2),uid(4),'approved','','Test',null);
 if result->>'error' is distinct from 'video_cambio' then raise exception 'missing file accepted';end if;
end$$;
rollback;
begin;
set local role anon;
do $$declare result jsonb;begin
 result:=submit_entregas_review_v2(uid(99),uid(4),'approved','','Test',uid(10));
 if result->>'error' is distinct from 'token_desconocido' then raise exception 'unknown token accepted';end if;
 result:=submit_entregas_review_v2(uid(2),uid(99),'approved','','Test',uid(10));
 if result->>'error' is distinct from 'video_no_es_de_este_enlace' then raise exception 'unrelated idea accepted';end if;
 result:=submit_entregas_review_v2(uid(2),uid(4),'rejected','Recortar','Test',uid(10));
 if result->>'ok' is distinct from 'true' then raise exception 'rejection failed: %',result;end if;
end$$;
reset role;
do $$begin
 if (select approval_status from content_ideas where id=uid(4)) is distinct from 'revision_needed' then raise exception 'not returned to editor';end if;
 if (select video_file_id from entregas_client_review_items where id=uid(3)) is distinct from uid(10) then raise exception 'rejected file not sealed';end if;
 if (select count(*) from content_idea_activity where content_idea_id=uid(4))<>1 then raise exception 'missing correction activity';end if;
end$$;
rollback;
begin;
update content_ideas set metricool_post_id=123;
do $$declare result jsonb;begin
 result:=submit_entregas_review_v2(uid(2),uid(4),'rejected','Recortar','Test',uid(10));
 if result->>'error' is distinct from 'video_ya_enviado' then raise exception 'sent file accepted';end if;
end$$;
rollback;
begin;
update entregas_client_review_items set status='approved',video_file_id=null;
do $$declare result jsonb;begin
 result:=get_entregas_review_v2(uid(2));
 if result#>>'{videos,0,video_key}' is not null then raise exception 'legacy vote invents approved media';end if;
end$$;
rollback;
