# User Admin (Sub-feature 1 of Users & Permissions) — Design Spec

**Date:** 2026-05-29
**Feature:** 1 of 3 — Admin base → Per-user overrides → Invite. This spec covers **Admin base only**.
**Status:** Approved design — pending spec review

## Goal

Give the owner a user-management surface on **/team**: edit a member's name/title, activate or
deactivate their access, and change their role (already exists). Close the page-level
permission gap on `/team`.

## Context (existing)

- RBAC: 5 roles (`owner`, `supervisor`, `editor`, `video`, legacy `team_member`), 62 permission
  slugs, `owner` = wildcard `*` (`lib/auth/permissions.ts`).
- `profiles` table: `id`, `email`, `full_name`, `avatar_url`, `role`, `title`, `created_at`,
  `updated_at`. **No status/active field.** First user auto-`owner` (trigger, migration 0001).
- `/team` (`app/(dashboard)/team/page.tsx`) shows members + workload; `RoleSelector`
  (`components/team/role-selector.tsx`) lets the owner change roles via `changeUserRole`
  (`lib/actions/team-roles.ts`, gated `assertOwner`, blocks demoting the last owner).
- Auth helpers: `assertOwner()`, `requirePermission()`, `currentUserHas()` (`lib/auth/server.ts`).
  `/team` page has **no** page-level `requirePermission` (gap; relies on sidebar filtering).
- Dashboard layout (`app/(dashboard)/layout.tsx`) already fetches the current profile + role.

## Key decisions (confirmed)

- Location: extend **/team** (workload overview stays intact).
- Manager: **owner only** (`assertOwner` / `team.assign_roles`).
- Scope here: edit name/title, activate/deactivate, role change (reuse). Overrides + invite are
  sub-features 2 and 3.

## Architecture

### 1. Data — migration `0028_profile_status.sql`

```sql
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));
notify pgrst, 'reload schema';
```

`lib/supabase/types.ts`: add `status: 'active' | 'inactive'` to `Profile` and a
`UserStatus` union.

### 2. Server actions — `lib/actions/users.ts` (new)

All start with `await assertOwner()`. House `{ ok?: true; error?: string }` return shape;
`revalidatePath('/team')`.

- `updateUserProfile(userId, { full_name, title })` — trims; `full_name` required (non-empty),
  `title` optional/nullable.
- `setUserStatus(userId, status)` — sets `profiles.status`.
  - **Safeguards:** cannot set your own account inactive; cannot deactivate the **last active
    owner** (count active owners; block if it would reach 0).

`changeUserRole` (existing) is reused unchanged (it already blocks demoting the last owner).

### 3. Deactivation enforcement

In `app/(dashboard)/layout.tsx` (server): after loading the profile, if `profile.status === 'inactive'`,
call `signOut()` and `redirect('/login?deactivated=1')`. This covers every dashboard route.
`app/(auth)/login` shows a notice when `?deactivated=1` is present.

### 4. UI — owner-only admin on /team

- `components/team/user-admin-table.tsx` (new): a table of all users — **name (inline-editable),
  email (read-only), role (existing `RoleSelector`), status (active/inactive toggle), title
  (inline-editable)**. Inactive rows are visually dimmed. Uses `useTransition` + toast
  (optimistic), matching house style.
- Rendered at the top of `/team`, wrapped so only the owner sees it
  (`<RoleGate perm="team.assign_roles">`). The existing workload overview stays below, untouched.
- **Page gate:** add `await requirePermission('team.read')` at the top of `/team/page.tsx`.

## Testing

- **Actions** (`users.test.ts`): `updateUserProfile` (trim, empty name rejected); `setUserStatus`
  (active↔inactive); safeguards — self-deactivation rejected, last-active-owner deactivation
  rejected; `assertOwner` gate (non-owner → error, no write).
- **Render**: `user-admin-table` shows rows; the table is owner-gated; toggling status / editing
  name calls the right action; inactive row is dimmed.

## Edge cases (handled + tested)

Last active owner (cannot deactivate or demote) · self-deactivation blocked · inactive user is
signed out on the next dashboard request · empty/whitespace name rejected · null title allowed ·
non-owner cannot see the admin table or call the actions.

## Out of scope

- Per-user permission overrides (sub-feature 2).
- Email invitations (sub-feature 3).
- Search/filter, bulk actions, editing email.

## File touch list

- `supabase/migrations/0028_profile_status.sql` (new)
- `lib/supabase/types.ts`
- `lib/actions/users.ts` (new) + test
- `app/(dashboard)/layout.tsx` (deactivation enforcement)
- `app/(dashboard)/team/page.tsx` (page gate + render admin table)
- `app/(auth)/login/page.tsx` (deactivated notice)
- `components/team/user-admin-table.tsx` (new) + test
