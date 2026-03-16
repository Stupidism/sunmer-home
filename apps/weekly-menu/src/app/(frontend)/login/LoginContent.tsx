'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

export function LoginContent() {
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered') === '1'
  const usernameFromQuery = searchParams.get('username') || ''
  const callbackUrl = useMemo(() => {
    const value = searchParams.get('callbackUrl')
    if (!value || !value.startsWith('/')) {
      return '/'
    }
    return value
  }, [searchParams])

  const [username, setUsername] = useState(usernameFromQuery)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
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
      setError('登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-6">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-900">登录</h1>
        <p className="mt-1 text-sm text-slate-500">支持管理员与普通用户账号</p>
        {registered ? <p className="mt-1 text-sm text-emerald-600">注册成功，请登录</p> : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="text"
            placeholder="用户名或用户ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            required
          />

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          还没有账号？{' '}
          <Link href="/register" className="font-semibold text-teal-700 hover:text-teal-800">
            去注册
          </Link>
        </p>
      </div>
    </main>
  )
}
