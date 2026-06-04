import { redirect } from 'next/navigation'

export default function Home() {
  // Landing principal: el Content Pipeline Board (por ahora).
  redirect('/pipeline')
}
