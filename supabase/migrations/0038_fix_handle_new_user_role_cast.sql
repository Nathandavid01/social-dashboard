-- Migration 0038: fix handle_new_user — cast the role CASE to user_role.
--
-- Migration 0036 rewrote the signup trigger to assign the role via
--   case when is_first then 'owner' else 'team_member' end
-- which has type `text`. The `profiles.role` column is the `user_role` enum, and
-- Postgres does NOT implicitly cast a CASE/text expression to an enum (it only
-- assignment-casts bare string literals like the original trigger used). So EVERY
-- new-user creation failed inside the trigger with:
--   column "role" is of type user_role but expression is of type text  (SQLSTATE 42804)
-- surfaced by GoTrue as the opaque "Database error creating new user".
--
-- Fix: cast the CASE result to user_role explicitly. Same body otherwise.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first boolean;
begin
  is_first := (select count(*) from public.profiles) = 0;
  insert into public.profiles (id, email, full_name, role, approval_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    (case when is_first then 'owner' else 'team_member' end)::public.user_role,
    case when is_first then 'approved' else 'pending' end
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
