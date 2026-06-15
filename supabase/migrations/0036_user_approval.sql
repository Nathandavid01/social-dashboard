-- Migration 0036: account approval workflow.
-- Self-signups land as 'pending' and cannot enter the dashboard until an owner
-- approves them. The very first account (the owner) is auto-approved, and every
-- pre-existing account is grandfathered to 'approved' so nobody gets locked out.
alter table public.profiles
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected'));

-- Grandfather everyone who already exists.
update public.profiles set approval_status = 'approved' where approval_status = 'pending';

-- Recreate the signup trigger so the first user (owner) is auto-approved and
-- everyone else is left 'pending' for an owner to review.
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
    case when is_first then 'owner' else 'team_member' end,
    case when is_first then 'approved' else 'pending' end
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
