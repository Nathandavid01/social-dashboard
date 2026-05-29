# User Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Owner-only user management on /team — edit name/title, activate/deactivate, change role — with deactivated users locked out.

**Architecture:** A `status` column on `profiles`, two `assertOwner`-gated server actions, deactivation enforced in the dashboard layout, and an owner-gated admin table on /team. Reuses the existing `RoleSelector` + `changeUserRole`.

**Tech Stack:** Next.js 14, Supabase, TypeScript, Tailwind, Vitest + RTL.

---

### Task 1: Migration + types

**Files:** Create `supabase/migrations/0028_profile_status.sql`; Modify `lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 0028: per-user account status (active/inactive) for user admin.
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Update the Profile type** in `lib/supabase/types.ts` — add `export type UserStatus = 'active' | 'inactive'` and add `status: UserStatus` to the `Profile` interface (next to `role`).

- [ ] **Step 3: Commit** — `git add supabase/migrations/0028_profile_status.sql lib/supabase/types.ts && git commit -m "feat: profiles.status column + type"`

---

### Task 2: Server actions (`lib/actions/users.ts`)

**Files:** Create `lib/actions/users.ts`; Test `lib/actions/users.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const assertOwner = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ assertOwner: () => assertOwner() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mutable supabase mock
let updatePayload: Record<string, unknown> | null = null
let ownerCount = 2
const authUserId = 'me'
function makeSupabase(targetStatus = 'active', targetRole = 'editor') {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: authUserId } } })) },
    from: vi.fn(() => ({
      update: vi.fn((p: Record<string, unknown>) => { updatePayload = p; return { eq: vi.fn(async () => ({ error: null })) } }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ count: ownerCount })),         // count active owners
          single: vi.fn(async () => ({ data: { id: 'u1', status: targetStatus, role: targetRole }, error: null })),
        })),
      })),
    })),
  }
}
let supa = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { updateUserProfile, setUserStatus } from './users'

beforeEach(() => { updatePayload = null; ownerCount = 2; assertOwner.mockResolvedValue(undefined); supa = makeSupabase() })

describe('updateUserProfile', () => {
  it('rejects an empty name', async () => {
    const res = await updateUserProfile('u1', { full_name: '  ', title: 'x' })
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })
  it('trims and saves name + title', async () => {
    const res = await updateUserProfile('u1', { full_name: ' Ana ', title: ' COO ' })
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ full_name: 'Ana', title: 'COO' })
  })
  it('is owner-gated', async () => {
    assertOwner.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await updateUserProfile('u1', { full_name: 'Ana' })
    expect(res.error).toBe('No autorizado')
    expect(updatePayload).toBeNull()
  })
})

describe('setUserStatus', () => {
  it('deactivates another active user', async () => {
    supa = makeSupabase('active', 'editor')
    const res = await setUserStatus('u1', 'inactive')
    expect(res.ok).toBe(true)
    expect(updatePayload).toMatchObject({ status: 'inactive' })
  })
  it('blocks self-deactivation', async () => {
    const res = await setUserStatus(authUserId, 'inactive')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })
  it('blocks deactivating the last active owner', async () => {
    supa = makeSupabase('active', 'owner'); ownerCount = 1
    const res = await setUserStatus('u1', 'inactive')
    expect(res.error).toBeTruthy()
    expect(updatePayload).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run lib/actions/users.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/actions/users.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertOwner } from '@/lib/auth/server'
import type { UserStatus } from '@/lib/supabase/types'

type Result = { ok?: true; error?: string }

export async function updateUserProfile(
  userId: string,
  values: { full_name: string; title?: string | null },
): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const fullName = values.full_name?.trim()
  if (!fullName) return { error: 'El nombre no puede estar vacío.' }
  const title = values.title?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, title, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/team')
  return { ok: true }
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (status === 'inactive') {
    if (user.id === userId) return { error: 'No puedes desactivar tu propia cuenta.' }
    const { data: target } = await supabase
      .from('profiles').select('id, status, role').eq('id', userId).single()
    if (target?.role === 'owner') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('status', 'active')
      if ((count ?? 0) <= 1) return { error: 'No puedes desactivar al último Owner activo.' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/team')
  return { ok: true }
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run lib/actions/users.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/actions/users.ts lib/actions/users.test.ts && git commit -m "feat: owner-only updateUserProfile + setUserStatus actions"`

> Note: the test's chained-mock shape is approximate — adjust the mock during Step 4 so the `count`-query (`.select(...).eq('role','owner').eq('status','active')`) and the single-row read both resolve as the tests expect.

---

### Task 3: Deactivation enforcement in the dashboard layout

**Files:** Modify `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add the redirect.** Import `redirect` from `next/navigation`. After the `profile`/`role` are loaded (right after `role = profile?.role ?? null`), add:

```tsx
  if (profile && profile.status === 'inactive') {
    await supabase.auth.signOut()
    redirect('/login?deactivated=1')
  }
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit** — `git add "app/(dashboard)/layout.tsx" && git commit -m "feat: lock out deactivated users from the dashboard"`

---

### Task 4: Deactivated notice on login

**Files:** Modify `app/(auth)/login/page.tsx`

- [ ] **Step 1: Show a banner when `?deactivated=1`.**

```tsx
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage({ searchParams }: { searchParams?: { deactivated?: string } }) {
  return (
    <>
      {searchParams?.deactivated && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Tu cuenta fue desactivada. Contacta a un administrador.
        </div>
      )}
      <LoginForm />
    </>
  )
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit** — `git add "app/(auth)/login/page.tsx" && git commit -m "feat: deactivated-account notice on login"`

---

### Task 5: User admin table component

**Files:** Create `components/team/user-admin-table.tsx`; Test `components/team/user-admin-table.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserAdminTable } from './user-admin-table'
import type { Profile } from '@/lib/supabase/types'

vi.mock('@/lib/actions/users', () => ({ updateUserProfile: vi.fn(), setUserStatus: vi.fn() }))
vi.mock('@/components/team/role-selector', () => ({ RoleSelector: () => <div data-testid="role-selector" /> }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const users = [
  { id: 'u1', email: 'a@x.com', full_name: 'Ana', role: 'editor', title: 'COO', status: 'active', avatar_url: null, created_at: '', updated_at: '' },
  { id: 'u2', email: 'b@x.com', full_name: 'Bob', role: 'video', title: null, status: 'inactive', avatar_url: null, created_at: '', updated_at: '' },
] as Profile[]

describe('UserAdminTable', () => {
  it('renders a row per user with name and email', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('a@x.com')).toBeInTheDocument()
    expect(screen.getByText('b@x.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ana')).toBeInTheDocument()
  })
  it('marks inactive users', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText(/Inactivo/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/team/user-admin-table.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/team/user-admin-table.tsx`** — a `'use client'` table. Per row: an `<input defaultValue={full_name}>` and `<input defaultValue={title ?? ''}>` that call `updateUserProfile` on blur (via `useTransition` + toast); the email as read-only text; the existing `<RoleSelector userId role viewerRole='owner' />`; a status toggle button calling `setUserStatus` (label "Activo"/"Inactivo"); inactive rows get `opacity-60`. Follow the responsive table + optimistic-toast house style. Disable the status toggle for `currentUserId === user.id`.

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/team/user-admin-table.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/team/user-admin-table.tsx components/team/user-admin-table.test.tsx && git commit -m "feat: user admin table"`

---

### Task 6: Wire into /team

**Files:** Modify `app/(dashboard)/team/page.tsx`

- [ ] **Step 1: Gate + load status/title + render table.** Add `import { requirePermission } from '@/lib/auth/server'`, `import { RoleGate } from '@/components/auth/role-gate'`, `import { UserAdminTable } from '@/components/team/user-admin-table'`. At the top of `TeamPage`, `await requirePermission('team.read')` and get the current user id (`const { data: { user } } = await supabase.auth.getUser()`). Change the profiles select to include `status, title`. Render above the overview:

```tsx
  return (
    <div className="space-y-6">
      <RoleGate perm="team.assign_roles">
        <UserAdminTable users={(profiles ?? []) as Profile[]} currentUserId={user?.id ?? ''} />
      </RoleGate>
      <TeamOverview members={members as (Profile & { tasks: Task[]; overdue: number })[]} />
    </div>
  )
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 3: Commit** — `git add "app/(dashboard)/team/page.tsx" && git commit -m "feat: surface user admin table on /team (owner-only) + page gate"`

---

### Task 7: Full verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass
- [ ] Stop any dev server on this worktree, then `npm run build` → exit 0
- [ ] Commit any fixes.
