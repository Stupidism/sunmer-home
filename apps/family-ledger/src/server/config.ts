import type { RuntimeConfiguration } from '@/lib/domain/types'

export function runtimeConfiguration(): RuntimeConfiguration {
  return {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    authSecret: Boolean(process.env.AUTH_SECRET),
  }
}

export function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error('DATABASE_URL is not configured')
  return value
}

export function assertRuntimeAuthentication(): void {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not configured')
  }
}
