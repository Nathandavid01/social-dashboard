-- Empty LOCAL test database only; not a replica of all production RLS.
create function uid(n int) returns uuid language sql immutable as $$select lpad(n::text,32,'0')::uuid$$;
create table entregas_client_reviews(id uuid primary key,token uuid,expires_at timestamptz);
create table entregas_client_review_items(id uuid primary key,review_id uuid,idea_id uuid,status text,comment text,reviewer_name text,decided_at timestamptz);
create table content_ideas(id uuid primary key,approval_status text,metricool_post_id bigint,status text,posted_at timestamptz,published_at timestamptz,posting_started_at timestamptz);
create table content_idea_activity(id bigint generated always as identity,content_idea_id uuid,user_id uuid,action text,metadata jsonb);
insert into entregas_client_reviews values(uid(1),uid(2),now()+interval '7 days');
insert into entregas_client_review_items values(uid(3),uid(1),uid(4),'pending',null,null,null);
insert into content_ideas values(uid(4),'approved',null,'producida',null,null,null);
