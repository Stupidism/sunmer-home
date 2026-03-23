'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@bubu-log/ui/card'
import { Badge } from '@bubu-log/ui/badge'
import { Button } from '@bubu-log/ui/button'
import { Spinner } from '@bubu-log/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@bubu-log/ui/alert-dialog'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@bubu-log/ui/pagination'
import Link from 'next/link'
import { Copy, Printer, Trash2 } from 'lucide-react'
import { getWeekStart } from '@/lib/utils/week'

type HistoryItem = {
  id: number
  weekStartDate: string
  status: 'DRAFT' | 'CONFIRMED'
  dishPreview: string[]
}

function formatWeekRange(weekStart: string) {
  const dateStr = typeof weekStart === 'string' ? weekStart.slice(0, 10) : ''
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  const y = d.getFullYear()
  const sm = d.getMonth() + 1
  const sd = d.getDate()
  const em = end.getMonth() + 1
  const ed = end.getDate()
  if (sm === em) return `${y}年${sm}月${sd}日–${ed}日`
  return `${y}年${sm}月${sd}日–${em}月${ed}日`
}

export function HistoryList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1)

  const [items, setItems] = useState<HistoryItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [copyTarget, setCopyTarget] = useState<{
    planId: number
    open: boolean
    existingStatus?: string
  }>({ planId: 0, open: false })
  const [deleteTarget, setDeleteTarget] = useState<{
    planId: number
    weekLabel: string
    open: boolean
  }>({ planId: 0, weekLabel: '', open: false })
  const [clearAllOpen, setClearAllOpen] = useState(false)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/weekly-plan/history?page=${currentPage}&pageSize=2`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '加载失败')
        return
      }
      setItems(data.items || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [currentPage])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const navigate = (page: number) => {
    router.push(`/history?page=${page}`)
  }

  const deletePlan = async (planId: number) => {
    try {
      const res = await fetch('/api/weekly-plan/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((data as { error?: string }).error || `删除失败 (${res.status})`)
        return
      }
      toast.success('已删除')
      setDeleteTarget((prev) => ({ ...prev, open: false }))
      fetchHistory()
    } catch (err) {
      console.error('Delete plan failed:', err)
      toast.error('删除失败')
    }
  }

  const deleteAllPlans = async () => {
    try {
      const res = await fetch('/api/weekly-plan/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        deletedCount?: number
      }
      if (!res.ok) {
        toast.error(data.error || `清空失败 (${res.status})`)
        return
      }
      toast.success(`已清空 ${data.deletedCount ?? 0} 条历史计划`)
      setClearAllOpen(false)
      fetchHistory()
    } catch (err) {
      console.error('Delete all plans failed:', err)
      toast.error('清空失败')
    }
  }

  const copyToCurrentWeek = async (planId: number, confirmOverwrite = false) => {
    const targetWeekStart = getWeekStart(new Date())
    try {
      const res = await fetch('/api/weekly-plan/copy-from-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePlanId: planId,
          targetWeekStart,
          confirmOverwrite,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.code === 'EXISTING_PLAN') {
        setCopyTarget({ planId, open: true, existingStatus: data.existingStatus })
        return
      }
      if (!res.ok) {
        toast.error(data.error || '复制失败')
        return
      }
      toast.success('已复制为当前周草稿')
      router.push(`/?week=${targetWeekStart}`)
    } catch {
      toast.error('复制失败')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">暂无历史计划</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-xs text-destructive hover:text-destructive active:scale-95 active:opacity-80"
          onClick={() => setClearAllOpen(true)}
        >
          清空历史
        </Button>
      </div>

      {items.map((item) => (
        <Card key={item.id} className="animate-fade-in">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold">
                {formatWeekRange(item.weekStartDate)}
              </span>
              <Badge
                variant={item.status === 'CONFIRMED' ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {item.status === 'CONFIRMED' ? '已确认' : '草稿'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {item.dishPreview.length > 0
                ? item.dishPreview.join('、')
                : '无菜品数据'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="text-xs active:scale-95 active:opacity-80"
                onClick={() => router.push(`/?week=${item.weekStartDate}`)}
              >
                查看详情
              </Button>
              <Link href={`/print/week?week=${item.weekStartDate}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs active:scale-95 active:opacity-80"
                >
                  <Printer className="h-3 w-3 mr-1" />
                  打印
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs active:scale-95 active:opacity-80"
                onClick={() => copyToCurrentWeek(item.id)}
              >
                <Copy className="h-3 w-3 mr-1" />
                复制到本周
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive active:scale-95 active:opacity-80"
                onClick={() =>
                  setDeleteTarget({
                    planId: item.id,
                    weekLabel: formatWeekRange(item.weekStartDate),
                    open: true,
                  })
                }
              >
                <Trash2 className="h-3 w-3 mr-1" />
                删除
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => navigate(Math.max(1, currentPage - 1))}
                className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-3 text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => navigate(Math.min(totalPages, currentPage + 1))}
                className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog
        open={copyTarget.open}
        onOpenChange={(open) => setCopyTarget((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖现有计划？</AlertDialogTitle>
            <AlertDialogDescription>
              当前周已有{copyTarget.existingStatus === 'CONFIRMED' ? '已确认的' : ''}计划，
              复制后将覆盖为新的草稿。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCopyTarget((prev) => ({ ...prev, open: false }))
                copyToCurrentWeek(copyTarget.planId, true)
              }}
            >
              确认覆盖
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget.open}
        onOpenChange={(open) => setDeleteTarget((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除计划？</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget.weekLabel}」的计划吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  const id = deleteTarget.planId
                  void deletePlan(id)
                }}
              >
                删除
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空所有历史计划？</AlertDialogTitle>
            <AlertDialogDescription>
              这会删除当前账号下全部历史计划，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={() => void deleteAllPlans()}>
                确认清空
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
