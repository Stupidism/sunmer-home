import { auth } from '@/lib/auth'

export async function getAuthenticatedUserId(): Promise<number | null> {
  const session = await auth()
  const id = (session?.user as { id?: string } | undefined)?.id
  if (!id) return null
  return Number(id)
}
