import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { RegisterContent } from './RegisterContent'

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/')
  }

  return <RegisterContent />
}
