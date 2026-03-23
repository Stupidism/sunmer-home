'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@bubu-log/ui/button'
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
import { Spinner } from '@bubu-log/ui/spinner'
import Link from 'next/link'
import { WeekSwitcher } from './WeekSwitcher'
import { DayCard } from './DayCard'
import { CandidateSheet } from './CandidateSheet'
import { getWeekStart } from '@/lib/utils/week'
import type {
  GeneratedSlot,
  GeneratedDish,
  DishCategory,
  PlanStatus,
} from '@/lib/types'

type PlanState =
  | { type: 'empty' }
  | { type: 'preview'; slots: GeneratedSlot[]; warnings: string[] }
  | { type: 'saved'; planId: number; status: PlanStatus; slots: GeneratedSlot[] }

type SaveStage = 'idle' | 'checking' | 'persisting' | 'finalizing'

export function WeeklyPlanView() {
  const searchParams = useSearchParams()
  const weekStart = useMemo(() => {
    return searchParams.get('week') || getWeekStart(new Date())
  }, [searchParams])

  const [planState, setPlanState] = useState<PlanState>({ type: 'empty' })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStage, setSaveStage] = useState<SaveStage>('idle')
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false)
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false)
  const [rotateCounts, setRotateCounts] = useState<Record<string, number>>({})
  const [rejectedDishIds, setRejectedDishIds] = useState<Record<string, number[]>>({})
  const [candidateSheet, setCandidateSheet] = useState<{
    open: boolean
    candidates: GeneratedDish[]
    slotIndex: number
    dishIndex: number
  }>({ open: false, candidates: [], slotIndex: 0, dishIndex: 0 })
  const saveStageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearSaveStageTimers = useCallback(() => {
    for (const timer of saveStageTimersRef.current) {
      clearTimeout(timer)
    }
    saveStageTimersRef.current = []
  }, [])

  const startSaveFeedback = useCallback(() => {
    clearSaveStageTimers()
    setSaveStage('checking')
    saveStageTimersRef.current.push(
      setTimeout(() => {
        setSaveStage('persisting')
      }, 600),
    )
    saveStageTimersRef.current.push(
      setTimeout(() => {
        setSaveStage('finalizing')
      }, 2400),
    )
  }, [clearSaveStageTimers])

  const stopSaveFeedback = useCallback(() => {
    clearSaveStageTimers()
    setSaveStage('idle')
  }, [clearSaveStageTimers])

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/weekly-plan?week=${weekStart}`)
      const data = await res.json()
      if (data.plan) {
        setPlanState({
          type: 'saved',
          planId: data.plan.id,
          status: data.plan.status as PlanStatus,
          slots: data.slots,
        })
        setRejectedDishIds({})
      } else {
        setPlanState({ type: 'empty' })
        setRejectedDishIds({})
      }
    } catch {
      toast.error('加载计划失败')
      setPlanState({ type: 'empty' })
      setRejectedDishIds({})
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  useEffect(() => {
    // 切换周后重置每道菜的连续点击计数
    setRotateCounts({})
    setRejectedDishIds({})
  }, [weekStart])

  useEffect(() => {
    return () => {
      clearSaveStageTimers()
    }
  }, [clearSaveStageTimers])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/weekly-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStartDate: weekStart }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '生成失败')
        return
      }
      setPlanState({
        type: 'preview',
        slots: data.slots,
        warnings: data.warnings || [],
      })
      setRotateCounts({})
      setRejectedDishIds({})
      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.info(w))
      }
    } catch {
      toast.error('生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerate = () => {
    if (planState.type === 'saved' && planState.status === 'CONFIRMED') {
      setConfirmRegenOpen(true)
      return
    }
    generate()
  }

  const savePlan = async (confirmOverwrite = false) => {
    const slots =
      planState.type === 'preview'
        ? planState.slots
        : planState.type === 'saved'
          ? planState.slots
          : null
    if (!slots) return

    setSaving(true)
    startSaveFeedback()
    try {
      const res = await fetch('/api/weekly-plan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStartDate: weekStart,
          slots,
          confirmOverwrite,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.code === 'EXISTING_DRAFT') {
        setConfirmOverwriteOpen(true)
        return
      }
      if (!res.ok) {
        toast.error(data.error || '保存失败')
        return
      }
      toast.success('已保存为草稿')
      setPlanState({
        type: 'saved',
        planId: data.id,
        status: 'DRAFT',
        slots,
      })
      setRotateCounts({})
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
      stopSaveFeedback()
    }
  }

  const confirmPlan = async () => {
    if (planState.type !== 'saved') return
    setSaving(true)
    try {
      const res = await fetch('/api/weekly-plan/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planState.planId,
          weekStartDate: weekStart,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '确认失败')
        return
      }
      toast.success('计划已确认')
      setPlanState((prev) =>
        prev.type === 'saved' ? { ...prev, status: 'CONFIRMED' } : prev,
      )
      setRotateCounts({})
    } catch {
      toast.error('确认失败')
    } finally {
      setSaving(false)
    }
  }

  const currentSlots = useMemo(() => {
    if (planState.type === 'preview') return planState.slots
    if (planState.type === 'saved') return planState.slots
    return []
  }, [planState])

  const isLocked =
    planState.type === 'saved' && planState.status === 'CONFIRMED'
  const interactionLocked = saving || generating

  const saveStageText: Record<Exclude<SaveStage, 'idle'>, string> = {
    checking: '正在校验草稿冲突...',
    persisting: '正在写入 14 餐草稿...',
    finalizing: '正在完成保存，请稍候...',
  }

  const saveStageProgress: Record<Exclude<SaveStage, 'idle'>, string> = {
    checking: 'w-1/3',
    persisting: 'w-2/3',
    finalizing: 'w-full',
  }

  const handleRotate = async (
    slotIndex: number,
    dishIndex: number,
    category: DishCategory,
  ) => {
    if (interactionLocked) return

    const key = `${slotIndex}-${dishIndex}`
    const nextCount = (rotateCounts[key] ?? 0) + 1
    const currentDish = currentSlots[slotIndex]?.dishes[dishIndex]
    const currentDishId = currentDish?.dishId
    const excludedDishIds = Array.from(
      new Set([
        ...(rejectedDishIds[key] ?? []),
        ...(typeof currentDishId === 'number' ? [currentDishId] : []),
      ]),
    )

    if (nextCount >= 3) {
      setRotateCounts((prev) => ({ ...prev, [key]: 0 }))
      await handleShowCandidates(slotIndex, dishIndex, category)
      return
    }

    setRotateCounts((prev) => ({ ...prev, [key]: nextCount }))

    try {
      const res = await fetch('/api/weekly-plan/replace-dish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotIndex,
          dishIndex,
          category,
          slots: currentSlots,
          mode: 'random',
          excludedDishIds,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.candidates?.length) {
        toast.error('没有可替换的菜品')
        return
      }
      const newDish = data.candidates[0] as GeneratedDish
      const newSlots = currentSlots.map((s, i) => {
        if (i !== slotIndex) return s
        const newDishes = [...s.dishes]
        newDishes[dishIndex] = newDish
        return { ...s, dishes: newDishes }
      })
      updateSlots(newSlots)
      setRejectedDishIds((prev) => ({ ...prev, [key]: excludedDishIds }))
    } catch {
      toast.error('替换失败')
    }
  }

  const handleShowCandidates = async (
    slotIndex: number,
    dishIndex: number,
    category: DishCategory,
  ) => {
    if (interactionLocked) return

    const key = `${slotIndex}-${dishIndex}`
    const currentDish = currentSlots[slotIndex]?.dishes[dishIndex]
    const currentDishId = currentDish?.dishId
    const excludedDishIds = Array.from(
      new Set([
        ...(rejectedDishIds[key] ?? []),
        ...(typeof currentDishId === 'number' ? [currentDishId] : []),
      ]),
    )

    try {
      const res = await fetch('/api/weekly-plan/replace-dish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotIndex,
          dishIndex,
          category,
          slots: currentSlots,
          mode: 'candidates',
          excludedDishIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('获取候选失败')
        return
      }
      setCandidateSheet({
        open: true,
        candidates: data.candidates || [],
        slotIndex,
        dishIndex,
      })
    } catch {
      toast.error('获取候选失败')
    }
  }

  const handleCandidateSelect = (dish: GeneratedDish) => {
    if (interactionLocked) return

    const { slotIndex, dishIndex } = candidateSheet
    const key = `${slotIndex}-${dishIndex}`
    const currentDish = currentSlots[slotIndex]?.dishes[dishIndex]
    const currentDishId = currentDish?.dishId
    const newSlots = currentSlots.map((s, i) => {
      if (i !== slotIndex) return s
      const newDishes = [...s.dishes]
      newDishes[dishIndex] = dish
      return { ...s, dishes: newDishes }
    })
    updateSlots(newSlots)
    setRotateCounts((prev) => ({ ...prev, [key]: 0 }))
    if (typeof currentDishId === 'number') {
      setRejectedDishIds((prev) => ({
        ...prev,
        [key]: Array.from(new Set([...(prev[key] ?? []), currentDishId])),
      }))
    }
  }

  const updateSlots = (newSlots: GeneratedSlot[]) => {
    if (planState.type === 'preview') {
      setPlanState({ ...planState, slots: newSlots })
    } else if (planState.type === 'saved') {
      setPlanState({ ...planState, slots: newSlots })
    }
  }

  const getDateStr = (dayOfWeek: number) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + dayOfWeek - 1)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <WeekSwitcher />
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <WeekSwitcher />

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {planState.type === 'empty' && (
            <Button
              className="flex-1 active:scale-95 active:opacity-80"
              onClick={handleGenerate}
              disabled={interactionLocked}
            >
            {generating ? '生成中...' : '生成本周菜单'}
          </Button>
        )}

        {planState.type === 'preview' && (
          <>
            <Button
              className="flex-1 active:scale-95 active:opacity-80"
              onClick={() => savePlan()}
              disabled={interactionLocked}
            >
              {saving ? '保存中...' : '保存草稿'}
            </Button>
            <Button
              variant="outline"
              className="active:scale-95 active:opacity-80"
              onClick={handleGenerate}
              disabled={interactionLocked}
            >
              重新生成
            </Button>
          </>
        )}

        {planState.type === 'saved' && planState.status === 'DRAFT' && (
          <>
            <Button
              className="flex-1 active:scale-95 active:opacity-80"
              onClick={confirmPlan}
              disabled={interactionLocked}
            >
              {saving ? '确认中...' : '确认计划'}
            </Button>
            <Link
              href={`/print/week?week=${weekStart}`}
              className={interactionLocked ? 'pointer-events-none opacity-50' : ''}
            >
              <Button variant="outline" size="sm" className="active:scale-95 active:opacity-80">
                打印
              </Button>
            </Link>
            <Button
              variant="outline"
              className="active:scale-95 active:opacity-80"
              onClick={() => savePlan()}
              disabled={interactionLocked}
            >
              保存更改
            </Button>
            <Button
              variant="ghost"
              className="active:scale-95 active:opacity-80"
              onClick={handleGenerate}
              disabled={interactionLocked}
            >
              重新生成
            </Button>
          </>
        )}

        {planState.type === 'saved' && planState.status === 'CONFIRMED' && (
          <>
            <Link
              href={`/print/week?week=${weekStart}`}
              className={interactionLocked ? 'pointer-events-none opacity-50' : ''}
            >
              <Button
                variant="outline"
                className="flex-1 active:scale-95 active:opacity-80"
              >
                打印
              </Button>
            </Link>
            <Button
              variant="outline"
              className="active:scale-95 active:opacity-80"
              onClick={handleGenerate}
              disabled={interactionLocked}
            >
              重新生成
            </Button>
          </>
        )}
      </div>

      {/* Status badge */}
      {planState.type === 'saved' && (
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              planState.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}
          >
            {planState.status === 'CONFIRMED' ? '已确认' : '草稿'}
          </span>
        </div>
      )}

      {planState.type === 'preview' && (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            预览
          </span>
        </div>
      )}

      {saving && saveStage !== 'idle' && (
        <div className="rounded-lg border border-blue-200/80 bg-blue-50/80 px-3 py-2 dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300">
              <Spinner className="h-3.5 w-3.5" />
              {saveStageText[saveStage]}
            </div>
            <span className="text-[11px] text-blue-700/80 dark:text-blue-300/80">编辑已锁定</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-200/70 dark:bg-blue-900/60">
            <div
              className={`h-full rounded-full bg-blue-500 transition-all duration-500 ${saveStageProgress[saveStage]}`}
            />
          </div>
        </div>
      )}

      {/* Day cards grid */}
      <div className="relative space-y-2 pb-4">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const lunchIdx = (day - 1) * 2
          const dinnerIdx = lunchIdx + 1
          const lunch = currentSlots[lunchIdx] ?? null
          const dinner = currentSlots[dinnerIdx] ?? null

          return (
            <DayCard
              key={day}
              dayOfWeek={day}
              dateStr={getDateStr(day)}
              lunchSlot={lunch}
              dinnerSlot={dinner}
              isLocked={isLocked || saving}
              lunchSlotIndex={lunchIdx}
              dinnerSlotIndex={dinnerIdx}
              onRotate={handleRotate}
            />
          )
        })}
        {saving && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
            <div className="rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              菜单正在保存，稍后可继续编辑
            </div>
          </div>
        )}
      </div>

      {/* Candidate sheet */}
      <CandidateSheet
        open={candidateSheet.open}
        onOpenChange={(open) =>
          setCandidateSheet((prev) => ({ ...prev, open }))
        }
        candidates={candidateSheet.candidates}
        onSelect={handleCandidateSelect}
      />

      {/* Overwrite confirmation */}
      <AlertDialog open={confirmOverwriteOpen} onOpenChange={setConfirmOverwriteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖现有草稿？</AlertDialogTitle>
            <AlertDialogDescription>
              该周已有草稿计划，保存后将覆盖现有内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOverwriteOpen(false)
                savePlan(true)
              }}
            >
              确认覆盖
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate confirmation for CONFIRMED plans */}
      <AlertDialog open={confirmRegenOpen} onOpenChange={setConfirmRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新生成？</AlertDialogTitle>
            <AlertDialogDescription>
              该周计划已确认。重新生成后需重新保存和确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmRegenOpen(false)
                generate()
              }}
            >
              确认重新生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
