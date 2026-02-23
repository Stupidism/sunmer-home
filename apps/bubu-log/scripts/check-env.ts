import { loadEnvConfig } from '@next/env'
import { getAuthEnvCheckResult } from '../src/lib/auth/config'

const appDir = process.cwd()
loadEnvConfig(appDir, process.env.NODE_ENV === 'development')

const { errors, warnings } = getAuthEnvCheckResult()

if (warnings.length > 0) {
  console.warn('[env-check][warn]', warnings.join(' | '))
}

if (errors.length > 0) {
  console.error('[env-check][error]', errors.join(' | '))
  process.exit(1)
}

console.log('[env-check] ok')
