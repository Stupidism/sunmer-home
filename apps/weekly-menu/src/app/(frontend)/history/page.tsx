'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'

type WeeklyPlan = Array<{
  day: string
  meals: Array<{
    label: string
    bigMeat: string
    smallMeat: string
    vegetable: string
  }>
}>

type WeeklyMenuHistoryItem = {
  id: string
  createdAt: string
  menuPeriod: string
  weeklyPlan: WeeklyPlan
}

export default function HistoryPage() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<WeeklyMenuHistoryItem[]>([])
  const [deletingId, setDeletingId] = useState('')

  const loadHistory = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/weekly-menus', { method: 'GET' })
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || '获取过往数据失败')
      }

      const payload = (await response.json()) as {
        data?: WeeklyMenuHistoryItem[]
        items?: WeeklyMenuHistoryItem[]
      }
      setItems(payload.data ?? payload.items ?? [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取过往数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError('')

    try {
      const response = await fetch(`/api/weekly-menus/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || '删除失败')
      }

      setItems((current) => current.filter((item) => item.id !== id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-5">
      <header className="relative mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition hover:bg-white"
          aria-label="打开导航菜单"
          title="导航菜单"
        >
          <Menu size={16} />
        </button>

        {menuOpen ? (
          <div className="absolute right-4 top-14 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="mb-1 px-2 py-1 text-xs font-semibold text-slate-500">快速导航</div>
            <button
              type="button"
              onClick={() => {
                router.push('/')
                setMenuOpen(false)
              }}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              主页面
            </button>
            <button
              type="button"
              onClick={() => {
                router.push('/recipes')
                setMenuOpen(false)
              }}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              菜谱库
            </button>
          </div>
        ) : null}

        <h1 className="text-center text-xl font-extrabold text-slate-900">过往数据</h1>
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            刷新
          </button>
        </div>
      </header>

      {loading ? <p className="text-center text-sm text-slate-500">加载中...</p> : null}
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="text-center text-sm text-slate-500">暂无过往数据</p>
      ) : null}

      <section className="space-y-3 pb-8">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-700">周菜单时间：{item.menuPeriod || '未设置'}</div>
              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === item.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            <div className="space-y-2">
              {item.weeklyPlan.map((dayPlan) => (
                <div key={`${item.id}-${dayPlan.day}`} className="rounded-lg bg-slate-50 p-2">
                  <div className="text-sm font-semibold text-slate-900">{dayPlan.day}</div>
                  <div className="mt-1 space-y-1 text-xs text-slate-700">
                    {dayPlan.meals.map((meal) => (
                      <div key={`${item.id}-${dayPlan.day}-${meal.label}`}>
                        {meal.label}: {meal.bigMeat} / {meal.smallMeat} / {meal.vegetable}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
