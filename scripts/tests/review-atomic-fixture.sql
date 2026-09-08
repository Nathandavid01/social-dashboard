-- Isolated empty test database only. Never run this fixture against Supabase.
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
create role authenticated;
create table public.profiles(id uuid primary key, role text, status text);
create table public.content_ideas(id uuid primary key, client_id uuid, title text, approval_status text, status text, created_by uuid, approved_video_id uuid, approved_by uuid, approved_at timestamptz, metricool_post_id bigint, posted_at timestamptz, posting_started_at timestamptz);
create table public.content_idea_videos(id uuid primary key, idea_id uuid, uploaded_by uuid, kind text, storage_provider text, status text);
create table public.content_idea_activity(id bigint generated always as identity,content_idea_id uuid,client_id uuid,user_id uuid,action text,metadata jsonb);
grant usage on schema public,auth to authenticated;
grant select,insert,update on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
insert into profiles values ('00000000-0000-0000-0000-000000000001','owner','active'),('00000000-0000-0000-0000-000000000002','editor','active');
insert into content_ideas(id,title,approval_status,status,created_by) values ('00000000-0000-0000-0000-000000000010','Test Video','submitted','producida','00000000-0000-0000-0000-000000000002');
insert into content_idea_videos values ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','edited','entregas-r2','uploaded');
