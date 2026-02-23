type AuthEnvIssue = {
  level: 'error' | 'warn'
  message: string
}

type AuthEnvCheckResult = {
  errors: string[]
  warnings: string[]
}

const BOOL_VALUES = new Set(['true', 'false'])

function isPresent(value?: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function collectAuthEnvIssues(env: NodeJS.ProcessEnv = process.env): AuthEnvIssue[] {
  const issues: AuthEnvIssue[] = []
  const isVercel = env.VERCEL === '1'

  const authSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET
  if (!isPresent(authSecret)) {
    issues.push({
      level: 'error',
      message: 'Missing AUTH_SECRET (or NEXTAUTH_SECRET).',
    })
  }

  if (!isPresent(env.AUTH_TRUST_HOST)) {
    if (isVercel) {
      issues.push({
        level: 'warn',
        message: 'Missing AUTH_TRUST_HOST; defaulting to true on Vercel.',
      })
    } else {
      issues.push({
        level: 'error',
        message: 'Missing AUTH_TRUST_HOST (set to true/false).',
      })
    }
  } else if (!BOOL_VALUES.has(String(env.AUTH_TRUST_HOST).toLowerCase())) {
    issues.push({
      level: 'error',
      message: 'Invalid AUTH_TRUST_HOST (must be true or false).',
    })
  }

  let authUrl = env.NEXTAUTH_URL || env.AUTH_URL
  if (!isPresent(authUrl) && isPresent(env.VERCEL_URL)) {
    authUrl = `https://${env.VERCEL_URL}`
    issues.push({
      level: 'warn',
      message: 'Missing NEXTAUTH_URL; using VERCEL_URL as fallback.',
    })
  }
  if (!isPresent(authUrl)) {
    issues.push({
      level: 'error',
      message: 'Missing NEXTAUTH_URL (or AUTH_URL).',
    })
  } else if (!isValidUrl(authUrl)) {
    issues.push({
      level: 'error',
      message: `Invalid NEXTAUTH_URL/AUTH_URL: ${authUrl}`,
    })
  }

  const googleId = env.GOOGLE_CLIENT_ID
  const googleSecret = env.GOOGLE_CLIENT_SECRET
  if (isPresent(googleId) || isPresent(googleSecret)) {
    if (!isPresent(googleId) || !isPresent(googleSecret)) {
      issues.push({
        level: 'error',
        message: 'Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      })
    }
  } else {
    issues.push({ level: 'warn', message: 'Google OAuth is not configured.' })
  }

  const githubId = env.GITHUB_CLIENT_ID
  const githubSecret = env.GITHUB_CLIENT_SECRET
  if (isPresent(githubId) || isPresent(githubSecret)) {
    if (!isPresent(githubId) || !isPresent(githubSecret)) {
      issues.push({
        level: 'error',
        message: 'GitHub OAuth requires both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
      })
    }
  } else {
    issues.push({ level: 'warn', message: 'GitHub OAuth is not configured.' })
  }

  const wechatId = env.WECHAT_APP_ID
  const wechatSecret = env.WECHAT_APP_SECRET
  if (isPresent(wechatId) || isPresent(wechatSecret)) {
    if (!isPresent(wechatId) || !isPresent(wechatSecret)) {
      issues.push({
        level: 'error',
        message: 'WeChat OAuth requires both WECHAT_APP_ID and WECHAT_APP_SECRET.',
      })
    }
  } else {
    issues.push({ level: 'warn', message: 'WeChat OAuth is not configured.' })
  }

  const wechatPlatform = env.WECHAT_PLATFORM_TYPE
  if (isPresent(wechatPlatform)) {
    if (wechatPlatform !== 'WebsiteApp' && wechatPlatform !== 'OfficialAccount') {
      issues.push({
        level: 'error',
        message: 'WECHAT_PLATFORM_TYPE must be WebsiteApp or OfficialAccount.',
      })
    }
  }

  const wechatRedirectUri = env.WECHAT_REDIRECT_URI
  if (isPresent(wechatRedirectUri) && !isValidUrl(wechatRedirectUri)) {
    issues.push({
      level: 'error',
      message: `Invalid WECHAT_REDIRECT_URI: ${wechatRedirectUri}`,
    })
  }

  return issues
}

export function getAuthEnvCheckResult(env: NodeJS.ProcessEnv = process.env): AuthEnvCheckResult {
  const issues = collectAuthEnvIssues(env)
  return {
    errors: issues.filter((issue) => issue.level === 'error').map((issue) => issue.message),
    warnings: issues.filter((issue) => issue.level === 'warn').map((issue) => issue.message),
  }
}

let hasLoggedWarnings = false

export function assertAuthEnv(env: NodeJS.ProcessEnv = process.env): void {
  const { errors, warnings } = getAuthEnvCheckResult(env)
  if (warnings.length > 0 && !hasLoggedWarnings) {
    console.warn('[auth-env][warn]', warnings.join(' | '))
    hasLoggedWarnings = true
  }
  if (errors.length > 0) {
    const message = `[auth-env][error] ${errors.join(' | ')}`
    throw new Error(message)
  }
}
