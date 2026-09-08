begin;
update content_ideas set metricool_post_id=123 where id=uid(4);
do $$declare result jsonb;begin
 result:=submit_entregas_review(uid(2),uid(4),'rejected','Recortar','Test');
 if result->>'error' is distinct from 'video_ya_enviado' then raise exception 'sent video accepted rejection: %',result;end if;
 if (select approval_status from content_ideas where id=uid(4))<>'approved' then raise exception 'sent state changed';end if;
 if (select status from entregas_client_review_items where id=uid(3))<>'pending' then raise exception 'vote changed';end if;
end$$;
rollback;
