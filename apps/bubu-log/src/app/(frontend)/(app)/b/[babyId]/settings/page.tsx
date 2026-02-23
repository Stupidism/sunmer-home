'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Copy, Loader2, PlusCircle } from 'lucide-react'
import { AvatarUpload } from '@/components/AvatarUpload'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'

const DEFAULT_SHORTCUT_INSTALL_URL = 'https://www.icloud.com/shortcuts/18673668cfaa4d1bac3f1ecac4646224'
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

export default function SettingsPage() {
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''

  const [isPreparing, setIsPreparing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authorizationValue, setAuthorizationValue] = useState<string | null>(null)
  const [boundBabyName, setBoundBabyName] = useState<string | null>(null)

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

  return (
    <main className="min-h-screen pb-10">
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-1 items-start gap-2.5">
          <BackHomeButton babyId={babyId} />
          <div>
            <h1 className="text-lg font-semibold">设置</h1>
            <p className="text-xs text-gray-500">头像与快捷指令</p>
          </div>
        </div>
        <AppDrawerMenu babyId={babyId} />
      </header>

      <section className="px-4 pt-6 space-y-4">
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 p-5 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 mb-4">当前宝宝头像</h2>
          <div className="flex flex-col items-center gap-3">
            <AvatarUpload />
            <p className="text-xs text-gray-500">点击头像可上传或更换，右上角可删除</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-medium text-gray-500">Siri 快捷指令</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <li>点击下方「新建快捷指令」。系统会为当前选中宝宝生成专属 token，并复制 Authorization 值到剪贴板。</li>
            <li>会自动打开 iCloud 快捷指令模板。先在快捷指令里找到动作「Get Contents of URL（获取 URL 内容）」。</li>
            <li>在这个动作里确认：Method = POST，Request Body = JSON，并保留 `text` 与 `localTime` 字段。</li>
            <li>把刚复制的值直接粘贴到「Get Contents of URL → Headers → Authorization」。</li>
          </ol>

          <div className="rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800/60 dark:bg-orange-900/20 p-3">
            <p className="text-xs font-medium text-orange-700 dark:text-orange-300">多宝宝提示（暂不支持）</p>
            <p className="text-xs text-orange-700/90 dark:text-orange-200/90 mt-1">
              webhook 语音输入暂不支持在同一个快捷指令中切换宝宝。当前 token 会固定绑定创建时选中的宝宝，多宝宝家庭请为每个宝宝分别创建一条快捷指令。
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 p-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">最重要：token 粘贴位置</p>
            <p className="text-xs text-amber-700/90 dark:text-amber-200/90 mt-1">
              在「Get Contents of URL」动作的 Headers 里，键填 `Authorization`，值粘贴完整 `Bearer v1...`，不要只粘贴 `v1...` 主体。
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
              已复制 Authorization 到剪贴板{boundBabyName ? `（绑定宝宝：${boundBabyName}）` : ''}（请按上面第 4 步粘贴）
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
      </section>
    </main>
  )
}
