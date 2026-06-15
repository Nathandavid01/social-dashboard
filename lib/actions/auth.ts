'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { notifyOwnersOfSignup } from '@/lib/actions/approvals'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/pipeline')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const fullName = formData.get('full_name') as string
  const email = formData.get('email') as string

  const data = {
    email,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: fullName,
      },
    },
  }

  const { data: signUpData, error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }

  // New self-signups land as 'pending' (see the handle_new_user trigger) and
  // must be approved by an owner before they can enter the dashboard. Let the
  // owners know there's someone to review.
  if (signUpData.user) {
    await notifyOwnersOfSignup({ id: signUpData.user.id, fullName, email }).catch(() => {})
  }

  revalidatePath('/', 'layout')
  redirect('/pending')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
