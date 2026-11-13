import type { RuntimeConfiguration } from './domain/types'

export interface AccessSession {
  id: string
}

export type DashboardAccess =
  | { allowed: true }
  | { allowed: false; status: 401 | 503; code: 'unauthenticated' | 'configuration' }

export function dashboardAccess(
  session: AccessSession | null | undefined,
  configuration: RuntimeConfiguration,
): DashboardAccess {
  if (!configuration.authSecret || !configuration.databaseUrl) {
    return { allowed: false, status: 503, code: 'configuration' }
  }
  if (!session?.id) return { allowed: false, status: 401, code: 'unauthenticated' }
  return { allowed: true }
}
