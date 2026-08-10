'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { assertActualOwner } from '@/lib/auth/server'
import {
  isRolePreviewTarget,
  ROLE_PREVIEW_COOKIE,
  type RolePreviewTarget,
} from '@/lib/auth/role-preview-core'

function ensureRolePreviewAvailable() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La vista de roles solo está disponible en desarrollo local.')
  }
}

export async function startRolePreview(role: RolePreviewTarget) {
  ensureRolePreviewAvailable()
  await assertActualOwner()

  if (!isRolePreviewTarget(role)) {
    throw new Error('Rol de vista previa inválido.')
  }

  const cookieStore = await cookies()
  cookieStore.set(ROLE_PREVIEW_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  })
  revalidatePath('/', 'layout')
  redirect('/video-reviews')
}

export async function stopRolePreview() {
  ensureRolePreviewAvailable()
  await assertActualOwner()

  const cookieStore = await cookies()
  cookieStore.delete(ROLE_PREVIEW_COOKIE)
  revalidatePath('/', 'layout')
  redirect('/video-reviews')
}
