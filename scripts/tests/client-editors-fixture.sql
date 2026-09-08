-- Empty LOCAL database only.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function uid(n int) returns uuid language sql immutable as $$select lpad(n::text,32,'0')::uuid$$;
create table profiles(id uuid primary key,role text,status text,approval_status text);
create table clients(id uuid primary key,assigned_to uuid,assignment_changed_by uuid,assignment_changed_at timestamptz);
create table recording_sessions(id uuid primary key,client_id uuid);
create table content_ideas(id uuid primary key,client_id uuid,recording_session_id uuid);
create table content_idea_videos(id uuid primary key,idea_id uuid);
insert into profiles values(uid(1),'supervisor','active','approved'),(uid(2),'editor','active','approved'),(uid(3),'editor','active','approved'),(uid(4),'video','active','approved');
insert into clients values(uid(10),uid(2),null,null);
insert into recording_sessions values(uid(20),null);
