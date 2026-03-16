'use client'

import Link from 'next/link'
import { useState } from 'react'

const REGISTER_TIMEOUT_MS = 15000

export function RegisterContent() {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS)
      let response: Response

      try {
        response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            username,
            name,
            userId,
            password,
          }),
        })
      } finally {
        window.clearTimeout(timeoutId)
      }

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || '注册失败')
      }

      window.location.href = `/login?registered=1&username=${encodeURIComponent(username)}`
    } catch (submitError) {
      if (submitError instanceof Error && submitError.name === 'AbortError') {
        setError('注册请求超时，请稍后重试')
      } else {
        setError(submitError instanceof Error ? submitError.message : '注册失败')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-6">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold text-slate-900">注册账号</h1>
        <p className="mt-1 text-sm text-slate-500">注册后默认角色为用户</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="text"
            placeholder="用户名（3-32位）"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            required
          />
          <input
            type="text"
            placeholder="姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            required
          />
          <input
            type="text"
            placeholder="用户ID（可选）"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
          />
          <input
            type="password"
            placeholder="密码（8-72位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            required
          />
          <input
            type="password"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            required
          />

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '注册中...' : '注册并登录'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          已有账号？{' '}
          <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-800">
            去登录
          </Link>
        </p>
      </div>
    </main>
  )
}
