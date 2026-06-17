import { redirect } from 'next/navigation'

// Public self-registration is disabled — accounts are created only from inside
// the app by an admin (Equipo → Crear usuario). Any hit to /signup goes to login.
export default function SignupPage() {
  redirect('/login')
}
