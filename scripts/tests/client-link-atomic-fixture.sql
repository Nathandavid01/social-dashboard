-- Empty LOCAL test database only. Never run in Supabase.
create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function uid(n int) returns uuid language sql immutable as $$select lpad(n::text,32,'0')::uuid$$;
create table profiles(id uuid primary key, role text, status text);
create table clients(id uuid primary key);
create table content_ideas(id uuid primary key,client_id uuid,status text);
create table content_idea_videos(id uuid primary key,idea_id uuid,kind text,storage_provider text,status text);
create table entregas_client_reviews(id uuid primary key default gen_random_uuid(),client_id uuid,token uuid default gen_random_uuid(),expires_at timestamptz,created_by uuid);
create table entregas_client_review_items(id uuid primary key default gen_random_uuid(),review_id uuid references entregas_client_reviews on delete cascade,idea_id uuid,status text default 'pending');
grant usage on schema public,auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
insert into profiles values(uid(1),'owner','active'),(uid(2),'video','active');
insert into clients values(uid(10));
insert into content_ideas values(uid(20),uid(10),'producida'),(uid(21),uid(10),'producida'),(uid(22),uid(11),'producida');
insert into content_idea_videos values(uid(30),uid(20),'edited','entregas-r2','uploaded'),(uid(31),uid(21),'edited','entregas-r2','uploaded');
insert into entregas_client_reviews(id,client_id,created_by) values(uid(40),uid(10),uid(1));
insert into entregas_client_review_items(review_id,idea_id) values(uid(40),uid(20)),(uid(40),uid(21));
