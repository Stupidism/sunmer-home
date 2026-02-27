'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Copy, Loader2, PlusCircle } from 'lucide-react'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'

const DEFAULT_SHORTCUT_INSTALL_URL = 'https://www.icloud.com/shortcuts/94ecee69ddf5404f9c3f24f824706500'
const ENV_SHORTCUT_INSTALL_URL = process.env.NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL?.trim() || ''
const SHORTCUT_INSTALL_URL = ENV_SHORTCUT_INSTALL_URL || DEFAULT_SHORTCUT_INSTALL_URL
const isUsingEnvShortcutUrl = ENV_SHORTCUT_INSTALL_URL.length > 0

type WebhookTokenResponse = {
  token: string
  expiresAt: string
  webhookUrl: string
  babyId: string
  babyName: string
  userId: string
}

function buildTokenUrl(babyId: string): string {
  const searchParams = new URLSearchParams({ days: '180' })
  if (babyId) {
    searchParams.set('babyId', babyId)
  }

  return `/api/webhooks/voice-input/token?${searchParams.toString()}`
}

function detectAppleDevice(): boolean | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  const userAgent = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIOS || isIPadOS
}

export default function SiriShortcutPage() {
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''

  const [isPreparing, setIsPreparing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authorizationValue, setAuthorizationValue] = useState<string | null>(null)
  const [boundBabyName, setBoundBabyName] = useState<string | null>(null)
  const isAppleDevice = detectAppleDevice()

  const settingsHref = useMemo(() => {
    return babyId ? `/b/${babyId}/settings` : '/settings'
  }, [babyId])

  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // Fallback to execCommand below.
    }

    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.setAttribute('readonly', '')
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    } catch {
      return false
    }
  }

  const handleManualCopy = async () => {
    if (!authorizationValue) {
      return
    }

    const didCopy = await copyText(authorizationValue)
    setCopied(didCopy)
    setError(didCopy ? null : '复制失败，请长按下方 Authorization 文本手动复制')
  }

  const prepareShortcut = async () => {
    const openedWindow = window.open(SHORTCUT_INSTALL_URL, '_blank', 'noopener,noreferrer')
    const popupBlocked = !openedWindow

    if (popupBlocked) {
      setError('浏览器拦截了新窗口，请允许弹窗后重试')
    }

    setIsPreparing(true)
    setCopied(false)
    setAuthorizationValue(null)
    setBoundBabyName(null)
    if (!popupBlocked) {
      setError(null)
    }

    try {
      const response = await fetch(buildTokenUrl(babyId), {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('生成快捷指令配置失败')
      }

      const data = (await response.json()) as WebhookTokenResponse
      setExpiresAt(data.expiresAt)
      setBoundBabyName(data.babyName || null)
      const authorization = `Bearer ${data.token}`
      setAuthorizationValue(authorization)

      const didCopy = await copyText(authorization)
      setCopied(didCopy)
      if (!didCopy) {
        setError('已生成 Authorization，但自动复制失败，请点击“手动复制 Authorization”')
      }
    } catch (err) {
      console.error(err)
      setError(popupBlocked ? '浏览器拦截了新窗口，且无法生成配置，请稍后重试' : '无法生成配置，请稍后重试')
    } finally {
      setIsPreparing(false)
    }
  }

  const isReadyForIOS = isAppleDevice !== false

  return (
    <main className="min-h-screen pb-10">
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-1 items-start gap-2.5">
          <Link
            href={settingsHref}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
            aria-label="返回设置"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">设置 Siri 快捷指令</h1>
            <p className="text-xs text-gray-500">创建语音记录入口（默认口令：记录宝宝）</p>
          </div>
        </div>
        <AppDrawerMenu babyId={babyId} />
      </header>

      <section className="px-4 pt-6 space-y-4">
        {!isReadyForIOS ? (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 p-5 shadow-sm space-y-2">
            <h2 className="text-sm font-medium text-gray-500">当前设备不支持 Siri 快捷指令</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Siri 快捷指令仅支持 iPhone / iPad。请在 iOS 设备上打开本页面完成设置。
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-medium text-gray-500">Siri 快捷指令</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>点击下方「新建快捷指令」。系统会为当前选中宝宝生成专属 token，并复制 Authorization 值到剪贴板。</li>
              <li>会自动打开 iCloud 快捷指令模板。可将快捷指令名称改成「记录宝宝」或你喜欢的口令。</li>
              <li>导入后会弹出输入问题，请在弹窗里粘贴完整 `Bearer v1...` token。</li>
              <li>添加完成后说：`Hey Siri，记录宝宝`（或你自定义的名称）即可触发。</li>
            </ol>

            <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-900/20 p-3">
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300">多宝宝提示（支持切换）</p>
              <p className="text-xs text-orange-700/90 dark:text-orange-200/90 mt-1">
                webhook 语音输入支持在同一个快捷指令中切换宝宝，但快捷指令请求里需要带 `babyId`。若模板未带该参数，仍会使用当前 token 创建时的默认宝宝。
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">最重要：token 粘贴位置</p>
              <p className="text-xs text-amber-700/90 dark:text-amber-200/90 mt-1">
                导入时弹出的提问里，直接粘贴完整 `Bearer v1...`，不要只粘贴 `v1...` 主体。
              </p>
            </div>

            <button
              type="button"
              onClick={prepareShortcut}
              disabled={isPreparing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm"
            >
              {isPreparing ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              {isPreparing ? '准备中...' : '新建快捷指令'}
            </button>

            {copied && (
              <p className="text-xs text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                <CheckCircle2 size={14} />
                已复制 Authorization 到剪贴板
                {boundBabyName ? `（绑定宝宝：${boundBabyName}）` : ''}
              </p>
            )}

            {authorizationValue && !copied && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleManualCopy}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                >
                  <Copy size={14} />
                  手动复制 Authorization
                </button>
                <textarea
                  value={authorizationValue}
                  readOnly
                  className="w-full h-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 p-2 text-xs font-mono"
                />
              </div>
            )}

            {expiresAt && (
              <p className="text-xs text-gray-500">Token 过期时间：{new Date(expiresAt).toLocaleString()}</p>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}
            {!isUsingEnvShortcutUrl && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                未配置 `NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL`，当前使用默认 iCloud 模板链接。要区分测试/生产环境，请在对应环境配置此变量。
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
