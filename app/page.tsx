import { redirect } from 'next/navigation'

export default function Home() {
  // Landing: lo que cada persona tiene que hacer hoy.
  redirect('/mi-dia')
}
