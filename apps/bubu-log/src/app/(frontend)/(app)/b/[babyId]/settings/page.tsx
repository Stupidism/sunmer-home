'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { AvatarUpload } from '@/components/AvatarUpload'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'

export default function SettingsPage() {
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''
  const [isAppleDevice] = useState<boolean | null>(() => {
    if (typeof navigator === 'undefined') {
      return null
    }
    const userAgent = navigator.userAgent || ''
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    return isIOS || isIPadOS
  })

  const siriSettingsHref = babyId ? `/b/${babyId}/settings/siri` : '/settings/siri'

  return (
    <main className="min-h-screen pb-10">
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-1 items-start gap-2.5">
          <BackHomeButton babyId={babyId} />
          <div>
            <h1 className="text-lg font-semibold">设置</h1>
            <p className="text-xs text-gray-500">头像与功能入口</p>
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
          <p className="text-sm text-gray-600 dark:text-gray-300">
            进入专属页面生成快捷指令 token，并完成 Siri 语音唤起配置。
          </p>
          {isAppleDevice === false ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-200 text-gray-500 font-medium text-sm dark:bg-gray-800 dark:text-gray-400"
            >
              <Settings2 size={16} />
              设置 Siri 快捷指令（仅 iOS）
            </button>
          ) : (
            <Link
              href={siriSettingsHref}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-sm"
            >
              <Settings2 size={16} />
              设置 Siri 快捷指令
            </Link>
          )}
          {isAppleDevice === false && (
            <p className="text-xs text-gray-500">当前设备不是 iPhone / iPad，Siri 快捷指令暂不可用。</p>
          )}
        </div>
      </section>
    </main>
  )
}
