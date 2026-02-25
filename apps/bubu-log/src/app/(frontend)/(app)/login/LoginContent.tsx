'use client'

import { useEffect, useMemo, useState } from 'react'
import { getProviders, signIn } from 'next-auth/react'
import { Baby, Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

type LoginContentProps = {
  requireConsent: boolean
}

export function LoginContent({ requireConsent }: LoginContentProps) {
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [trialConsent, setTrialConsent] = useState(false)
  const [guardianConsent, setGuardianConsent] = useState(false)
  const [overseasConsent, setOverseasConsent] = useState(false)
  const [providers, setProviders] = useState<Record<string, { id: string }> | null>(null)
  const [providersError, setProvidersError] = useState(false)
  const callbackUrl = useMemo(() => {
    const value = searchParams.get('callbackUrl')
    if (!value || !value.startsWith('/')) {
      return '/'
    }
    return value
  }, [searchParams])

  useEffect(() => {
    let active = true
    getProviders()
      .then((result) => {
        if (!active) return
        setProviders(result ?? {})
      })
      .catch(() => {
        if (!active) return
        setProvidersError(true)
        setProviders({})
      })
    return () => {
      active = false
    }
  }, [])

  const isProviderAvailable = (id: string) => Boolean(providers?.[id])
  const providersReady = providers !== null

  const googleEnabled = isProviderAvailable('google')
  const githubEnabled = isProviderAvailable('github')
  const wechatEnabled = isProviderAvailable('wechat')
  const allowLogin = !requireConsent || (trialConsent && guardianConsent && overseasConsent)
  const googleDisabled = !providersReady || !googleEnabled || !allowLogin
  const githubDisabled = !providersReady || !githubEnabled || !allowLogin
  const wechatDisabled = !providersReady || !wechatEnabled || !allowLogin
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!allowLogin) {
      setError('请先阅读并勾选下方同意事项')
      return
    }
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError('用户名或密码错误')
      } else {
        window.location.href = result?.url || callbackUrl
      }
    } catch {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fefbf6] to-[#fff5e6] dark:from-[#1a1a2e] dark:to-[#16213e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Baby size={40} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">卜卜日记</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">记录宝宝的每一天</p>
        </div>

        <form onSubmit={handleCredentialsLogin} className="space-y-4 mb-6">
          <div>
            <input
              type="text"
              placeholder="用户名或邮箱"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              data-testid="login-username-input"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 pr-12"
              required
              data-testid="login-password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !allowLogin}
            className="w-full px-4 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="login-submit-btn"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/70 bg-white/70 dark:bg-gray-900/60 p-4 space-y-3 text-xs text-gray-600 dark:text-gray-300">
          <p className="text-xs text-gray-500">内测说明：仅限受邀熟人参与，不对外公开，请勿传播链接或邀请非熟人。</p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={trialConsent}
              onChange={(event) => setTrialConsent(event.target.checked)}
              data-testid="login-consent-trial"
              className="mt-0.5"
            />
            <span>我已知悉这是内测，仅限受邀熟人参与</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={guardianConsent}
              onChange={(event) => setGuardianConsent(event.target.checked)}
              data-testid="login-consent-guardian"
              className="mt-0.5"
            />
            <span>我确认自己是监护人，同意处理婴幼儿喂养、睡眠等敏感个人信息，用于生成个人记录与提醒</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={overseasConsent}
              onChange={(event) => setOverseasConsent(event.target.checked)}
              data-testid="login-consent-overseas"
              className="mt-0.5"
            />
            <span>我知悉并同意：数据存储与处理在中国境外服务器上进行</span>
          </label>
          <p className="text-xs text-gray-500">可在设置中删除账号与数据。</p>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gradient-to-b from-[#fefbf6] to-[#fff5e6] dark:from-[#1a1a2e] dark:to-[#16213e] text-gray-400">或使用第三方账号</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              if (!allowLogin) {
                setError('请先阅读并勾选下方同意事项')
                return
              }
              if (!googleEnabled) return
              void signIn('google', { callbackUrl })
            }}
            disabled={googleDisabled}
            aria-disabled={googleDisabled}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-shadow ${googleDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            data-testid="login-google-btn"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium text-gray-700 dark:text-gray-200">{googleEnabled ? '使用 Google 登录' : 'Google 暂不可用'}</span>
          </button>

          <button
            onClick={() => {
              if (!allowLogin) {
                setError('请先阅读并勾选下方同意事项')
                return
              }
              if (!githubEnabled) return
              void signIn('github', { callbackUrl })
            }}
            disabled={githubDisabled}
            aria-disabled={githubDisabled}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 dark:bg-gray-700 rounded-xl shadow-sm transition-shadow ${githubDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            data-testid="login-github-btn"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-white">{githubEnabled ? '使用 GitHub 登录' : 'GitHub 暂不可用'}</span>
          </button>

          <button
            onClick={() => {
              if (!allowLogin) {
                setError('请先阅读并勾选下方同意事项')
                return
              }
              if (!wechatEnabled) return
              void signIn('wechat', { callbackUrl })
            }}
            disabled={wechatDisabled}
            aria-disabled={wechatDisabled}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#07C160] rounded-xl shadow-sm transition-shadow ${wechatDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
            data-testid="login-wechat-btn"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
            </svg>
            <span className="font-medium text-white">{wechatEnabled ? '使用微信登录' : '微信暂不可用'}</span>
          </button>
          {providersError && <p className="text-xs text-center text-amber-500">登录方式加载失败，请稍后刷新</p>}
        </div>

        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8">登录前请先阅读并确认内测与隐私说明</p>
      </div>
    </main>
  )
}
