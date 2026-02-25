import { Suspense } from 'react'

import { LoginContent } from './LoginContent'

function shouldRequireConsentInCurrentEnv(): boolean {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production'
  }

  return process.env.NODE_ENV === 'production'
}

export default function LoginPage() {
  const requireConsent = shouldRequireConsentInCurrentEnv()

  return (
    <Suspense fallback={null}>
      <LoginContent requireConsent={requireConsent} />
    </Suspense>
  )
}
