'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Menu } from 'lucide-react'

type RecipeCategory = 'big-meat' | 'small-meat' | 'vegetable'
type RecipeFilter = 'all' | RecipeCategory

type PayloadRecipe = {
  id: number | string
  name?: string
  category?: RecipeCategory
  description?: string | null
}

type UserRecipeSubmission = {
  id: string
  name: string
  category: RecipeCategory
  description: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
}

type RecipeListItem = {
  id: string
  name: string
  category: RecipeCategory
  description: string | null
  source: 'public' | 'mine-pending' | 'mine-approved' | 'mine-rejected'
  reviewNote: string | null
}

const filterOptions: Array<{ value: RecipeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'big-meat', label: '大荤' },
  { value: 'small-meat', label: '小荤' },
  { value: 'vegetable', label: '素菜' },
]

const categoryLabel: Record<RecipeCategory, string> = {
  'big-meat': '大荤',
  'small-meat': '小荤',
  vegetable: '素菜',
}

export default function RecipesPage() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<RecipeFilter>('all')
  const [items, setItems] = useState<RecipeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadRecipesFromDashboard = async () => {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({
          depth: '0',
          limit: '200',
          sort: 'name',
        })

        if (activeFilter !== 'all') {
          params.set('where[category][equals]', activeFilter)
        }

        const response = await fetch(`/api/planner-recipes?${params.toString()}`, { method: 'GET' })
        if (!response.ok) {
          const payload = (await response.json()) as { message?: string }
          throw new Error(payload.message || '读取菜谱失败')
        }

        const payload = (await response.json()) as { docs?: PayloadRecipe[] }
        const publicItems = (payload.docs ?? []).map<RecipeListItem>((item) => ({
          id: `public-${String(item.id)}`,
          name: item.name || '-',
          category: item.category || 'vegetable',
          description: item.description || null,
          source: 'public',
          reviewNote: null,
        }))

        const myResponse = await fetch('/api/user-recipes', { method: 'GET' })
        const myPayload = myResponse.ok
          ? ((await myResponse.json()) as { data?: UserRecipeSubmission[]; items?: UserRecipeSubmission[] })
          : { data: [] }
        const myItemsRaw = myPayload.data ?? myPayload.items ?? []

        const seen = new Set(publicItems.map((item) => `${item.name}::${item.category}`))
        const myItems: RecipeListItem[] = []

        for (const item of myItemsRaw) {
          const key = `${item.name}::${item.category}`
          if (seen.has(key)) {
            continue
          }
          seen.add(key)
          myItems.push({
            id: `mine-${item.id}`,
            name: item.name,
            category: item.category,
            description: item.description,
            source:
              item.status === 'approved'
                ? 'mine-approved'
                : item.status === 'rejected'
                  ? 'mine-rejected'
                  : 'mine-pending',
            reviewNote: item.reviewNote,
          })
        }

        const mergedItems = [...publicItems, ...myItems]

        if (active) {
          setItems(mergedItems)
        }
      } catch (fetchError) {
        if (active) {
          setItems([])
          setError(fetchError instanceof Error ? fetchError.message : '读取菜谱失败')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadRecipesFromDashboard()

    return () => {
      active = false
    }
  }, [activeFilter])

  const summary = useMemo(() => `${items.length} 道菜`, [items.length])

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <section className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
                router.push('/history')
                setMenuOpen(false)
              }}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              过往数据
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2 pr-12">
          <h1 className="text-xl font-extrabold text-slate-900">菜谱库</h1>
        </div>

        <p className="mt-2 text-xs text-slate-500">数据来源：公共菜谱库 + 我的上传菜谱</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setActiveFilter(option.value)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                activeFilter === option.value
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-2 text-xs text-slate-500">当前：{summary}</div>
      </section>

      <section className="mt-4 space-y-2 pb-8">
        {loading ? <p className="text-center text-sm text-slate-500">加载中...</p> : null}
        {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-center text-sm text-slate-500">当前筛选下暂无数据</p>
        ) : null}

        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                  {categoryLabel[item.category]}
                </span>
                {item.source === 'public' ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    公共
                  </span>
                ) : null}
                {item.source === 'mine-pending' ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                    我的待审
                  </span>
                ) : null}
                {item.source === 'mine-approved' ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                    我的已通过
                  </span>
                ) : null}
                {item.source === 'mine-rejected' ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                    我的驳回
                  </span>
                ) : null}
              </div>
            </div>
            {item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}
            {item.source === 'mine-rejected' && item.reviewNote ? (
              <p className="mt-1 text-[11px] text-rose-600">审核备注：{item.reviewNote}</p>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  )
}
