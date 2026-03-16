import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginContent } from './LoginContent'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/')
  }

  return <LoginContent />
}
