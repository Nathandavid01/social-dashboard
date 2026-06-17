-- Migration 0038: restore the "owner can update any profile" RLS policy.
--
-- Production drifted from 0001 and was missing `"profiles: owner update role"`,
-- leaving only `"profiles: own update"` (auth.uid() = id). Effect: every admin
-- edit of ANOTHER user — role, status, area_access, approval, title — was
-- silently filtered out by RLS (UPDATE 0 rows, no error from PostgREST), so the
-- changes appeared to "not save". Recreate the policy idempotently.
drop policy if exists "profiles: owner update role" on public.profiles;
create policy "profiles: owner update role"
  on public.profiles for update to authenticated
  using (public.get_my_role() = 'owner')
  with check (public.get_my_role() = 'owner');
