'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { dayjs } from '@/lib/dayjs'
import { useAudits, type AuditLog } from '@/lib/api/hooks'
import { 
  History,
  Mic,
  Keyboard,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'
import { APP_MAIN_LAYOUT_CLASS } from '@/lib/branding'

// 操作类型标签
const actionLabels: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '修改',
  DELETE: '删除',
}

// 操作类型颜色
const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  UPDATE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  DELETE: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

// 渲染活动数据差异
function renderActivityDiff(beforeData: Record<string, unknown> | null, afterData: Record<string, unknown> | null) {
  if (!beforeData && !afterData) return null

  const fields: { key: string; label: string; format?: (v: unknown) => string }[] = [
    { key: 'type', label: '类型' },
    { key: 'startTime', label: '开始时间', format: (v) => v ? dayjs(v as string).format('MM-DD HH:mm') : '无' },
    { key: 'endTime', label: '结束时间', format: (v) => v ? dayjs(v as string).format('MM-DD HH:mm') : '无' },
    { key: 'milkAmount', label: '奶量', format: (v) => v ? `${v}ml` : '无' },
    { key: 'hasPoop', label: '大便', format: (v) => v ? '有' : '无' },
    { key: 'hasPee', label: '小便', format: (v) => v ? '有' : '无' },
    { key: 'poopColor', label: '便便颜色' },
    { key: 'peeAmount', label: '小便量' },
    { key: 'burpSuccess', label: '拍嗝', format: (v) => v === true ? '成功' : v === false ? '未成功' : '无' },
    { key: 'breastFirmness', label: '乳房硬度' },
    { key: 'notes', label: '备注', format: (v) => v ? String(v) : '无' },
  ]

  const changes: { label: string; before: string; after: string }[] = []

  for (const field of fields) {
    const beforeVal = beforeData?.[field.key]
    const afterVal = afterData?.[field.key]
    
    // 只显示有变化的字段，或者在创建/删除时显示有值的字段
    const hasChange = beforeVal !== afterVal
    const hasValue = beforeVal !== undefined || afterVal !== undefined
    
    if (hasChange && hasValue) {
      const format = field.format || ((v) => String(v ?? '无'))
      changes.push({
        label: field.label,
        before: format(beforeVal),
        after: format(afterVal),
      })
    }
  }

  if (changes.length === 0) return null

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm space-y-2">
      {changes.map((change, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="font-medium text-gray-600 dark:text-gray-400 min-w-16">{change.label}:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {beforeData && change.before !== '无' && (
              <span className="line-through text-red-500 dark:text-red-400">{change.before}</span>
            )}
            {beforeData && afterData && change.before !== '无' && change.after !== '无' && (
              <span className="text-gray-400">→</span>
            )}
            {afterData && change.after !== '无' && (
              <span className="text-green-600 dark:text-green-400">{change.after}</span>
            )}
            {!beforeData && change.after === '无' && (
              <span className="text-gray-400">无</span>
            )}
            {!afterData && change.before === '无' && (
              <span className="text-gray-400">无</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// 审计日志项组件
function AuditLogItem({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const hasDiff = log.beforeData || log.afterData

  const getActionIcon = () => {
    if (log.success === false) return <X size={18} />
    switch (log.action) {
      case 'CREATE': return <Plus size={18} />
      case 'UPDATE': return <Pencil size={18} />
      case 'DELETE': return <Trash2 size={18} />
      default: return log.inputMethod === 'VOICE' ? <Mic size={18} /> : <Keyboard size={18} />
    }
  }

  const getIconStyle = () => {
    if (log.success === false) return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    return actionColors[log.action] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }

  return (
    <div
      className={`rounded-2xl p-4 shadow-sm ${
        log.success === false
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconStyle()}`}>
          {getActionIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${getIconStyle()}`}>
                {actionLabels[log.action] || log.action}
              </span>
              {log.inputMethod === 'VOICE' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  语音
                </span>
              )}
              {log.success === false && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
                  失败
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {dayjs(log.createdAt).format('MM-DD HH:mm:ss')}
            </span>
          </div>
          
          {log.description && (
            <p className={`text-base break-words ${
              log.success === false
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {log.description}
            </p>
          )}

          {log.errorMessage && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">
              错误: {log.errorMessage}
            </p>
          )}

          {hasDiff && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-primary hover:underline mt-2 flex items-center gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp size={16} />
                  收起详情
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  查看详情
                </>
              )}
            </button>
          )}

          {expanded && hasDiff && (
            renderActivityDiff(
              log.beforeData as Record<string, unknown> | null,
              log.afterData as Record<string, unknown> | null
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuditsPage() {
  const [offset, setOffset] = useState(0)
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''
  const limit = 30
  
  const { data: auditsData, isLoading } = useAudits({ limit, offset })

  const handleLoadMore = () => {
    setOffset(prev => prev + limit)
  }

  const handleLoadPrev = () => {
    setOffset(prev => Math.max(0, prev - limit))
  }

  return (
    <main className={`${APP_MAIN_LAYOUT_CLASS} safe-area-top safe-area-bottom`}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BackHomeButton babyId={babyId} />
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
              <History size={22} />
              操作记录
            </h1>
          </div>
          <AppDrawerMenu babyId={babyId} />
        </div>
      </header>

      {/* 内容区域 */}
      <section className="px-4 py-4">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500 text-lg">加载中...</div>
        ) : !auditsData?.data?.length ? (
          <div className="text-center py-12 text-gray-500 text-lg">暂无操作记录</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                共 {auditsData.total} 条记录
                {offset > 0 && ` (第 ${offset + 1} - ${Math.min(offset + limit, auditsData.total ?? 0)} 条)`}
              </p>
            </div>

            <div className="space-y-3">
              {auditsData.data.map((log: AuditLog) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
            </div>

            {/* 分页 */}
            <div className="flex items-center justify-center gap-4 mt-6 pb-4">
              {offset > 0 && (
                <button
                  onClick={handleLoadPrev}
                  className="px-6 py-3 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium shadow-sm"
                >
                  上一页
                </button>
              )}
              {auditsData.hasMore && (
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-3 rounded-full bg-primary text-white font-medium shadow-sm"
                >
                  下一页
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
