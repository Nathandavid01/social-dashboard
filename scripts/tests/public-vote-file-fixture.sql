-- Run after public-vote-fixture.sql in a fresh LOCAL database.
alter table entregas_client_reviews add column client_id uuid;
alter table entregas_client_review_items add column video_file_id uuid, add column created_at timestamptz default now();
alter table content_ideas add column title text;
create table clients(id uuid primary key,name text);
create table content_idea_videos(id uuid primary key,idea_id uuid,kind text,storage_provider text,status text,drive_file_id text,uploaded_at timestamptz);
insert into content_idea_videos values(uid(10),uid(4),'edited','entregas-r2',null,'original.mp4',now());
