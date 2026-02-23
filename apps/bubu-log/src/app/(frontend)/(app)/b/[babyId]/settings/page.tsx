'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Settings2, Trash2 } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { toast } from 'sonner'
import { AvatarUpload } from '@/components/AvatarUpload'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'
import { BottomSheet } from '@/components/BottomSheet'

const PRIVACY_CONTACT_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || ''

function detectAppleDevice(): boolean | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  const userAgent = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIOS || isIPadOS
}

export default function SettingsPage() {
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''
  const isAppleDevice = detectAppleDevice()
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const siriSettingsHref = babyId ? `/b/${babyId}/settings/siri` : '/settings/siri'

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true)
    try {
      const response = await fetch('/api/account', { method: 'DELETE' })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || '删除账号失败，请稍后重试')
      }

      toast.success('账号与数据已删除')
      const redirectUrl = '/login?deleted=1'
      const signOutResult = await signOut({ callbackUrl: redirectUrl, redirect: false })
      window.location.assign(signOutResult?.url || redirectUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除账号失败，请稍后重试'
      toast.error(message)
    } finally {
      setIsDeletingAccount(false)
      setDeleteAccountOpen(false)
    }
  }

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
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-medium text-gray-500">内测与隐私说明</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            本产品仅限受邀熟人内测，不对外公开。请勿传播链接或邀请非熟人参与。
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            处理信息：账号邮箱、宝宝喂养与睡眠等记录（属于敏感个人信息），仅用于生成个人记录与提醒，不对外共享。
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            数据存储与处理在中国境外服务器上进行。如需查询、更正或删除数据，可在下方操作或联系：
            {PRIVACY_CONTACT_EMAIL ? (
              <a
                href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
                className="ml-1 text-primary underline underline-offset-2"
              >
                {PRIVACY_CONTACT_EMAIL}
              </a>
            ) : (
              <span className="ml-1">邀请你内测的人</span>
            )}
            。
          </p>
        </div>

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

        <div className="rounded-2xl border border-red-100 dark:border-red-900/50 bg-white/80 dark:bg-gray-900/60 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-medium text-red-600">删除账号与数据</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            这将删除你的账号以及名下宝宝的记录数据，删除后无法恢复。
          </p>
          <button
            type="button"
            onClick={() => setDeleteAccountOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white"
          >
            <Trash2 size={16} />
            删除账号与数据
          </button>
        </div>
      </section>

      <BottomSheet
        isOpen={deleteAccountOpen}
        onClose={() => {
          if (!isDeletingAccount) {
            setDeleteAccountOpen(false)
          }
        }}
        title="确认删除账号"
      >
        <div className="space-y-6">
          <p className="text-center text-lg text-gray-600 dark:text-gray-400">
            将永久删除账号与所有宝宝记录，且无法撤销。确定继续吗？
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeleteAccountOpen(false)}
              disabled={isDeletingAccount}
              className="p-4 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-lg"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="p-4 rounded-2xl bg-red-500 text-white font-semibold text-lg"
            >
              {isDeletingAccount ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </main>
  )
}
