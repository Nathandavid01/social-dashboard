-- ============================================================
-- Migration 0023: avatars storage bucket
-- ============================================================
-- Public bucket so avatars render via <img> in presence bar, team page,
-- topbar, etc. Any authenticated user can upload their own avatar.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read"  on storage.objects;
drop policy if exists "avatars auth insert"  on storage.objects;
drop policy if exists "avatars auth update"  on storage.objects;
drop policy if exists "avatars auth delete"  on storage.objects;
create policy "avatars public read"  on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars auth insert"  on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars auth update"  on storage.objects for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
create policy "avatars auth delete"  on storage.objects for delete to authenticated using (bucket_id = 'avatars');

notify pgrst, 'reload schema';
