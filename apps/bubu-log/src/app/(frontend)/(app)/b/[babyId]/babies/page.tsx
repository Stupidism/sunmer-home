'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Baby, Camera, CheckCircle2, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'
import {
  replaceBabyIdInPathname,
  withBabyIdOnApiPath,
  withCurrentBabyIdOnApiPath,
} from '@/lib/baby-scope'

type Gender = 'BOY' | 'GIRL' | 'OTHER'

type BabyItem = {
  id: string
  name: string
  fullName: string | null
  avatarUrl: string | null
  birthDate: string | null
  gender: Gender | null
  isDefault: boolean
}

type BabiesResponse = {
  data: BabyItem[]
  defaultBabyId: string | null
  currentBabyId: string | null
}

type BabyFormState = {
  name: string
  fullName: string
  birthDate: string
  gender: Gender
  isDefault: boolean
}

const INITIAL_FORM: BabyFormState = {
  name: '',
  fullName: '',
  birthDate: '',
  gender: 'OTHER',
  isDefault: false,
}

function normalizeName(name: string): string {
  return name.trim()
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

export default function BabiesPage() {
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [babies, setBabies] = useState<BabyItem[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<BabyFormState>(INITIAL_FORM)
  const [editingBabyId, setEditingBabyId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<BabyFormState>(INITIAL_FORM)
  const [avatarPendingBabyId, setAvatarPendingBabyId] = useState<string | null>(null)

  const loadBabies = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/user-babies'), { cache: 'no-store' })
      const payload = (await response.json()) as BabiesResponse | { error?: string }
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || '加载宝宝列表失败')
      }

      setBabies((payload as BabiesResponse).data || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载宝宝列表失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBabies()
  }, [loadBabies])

  const resetCreateForm = useCallback(() => {
    setCreateForm(INITIAL_FORM)
    setShowCreateForm(false)
  }, [])

  const validateForm = (form: BabyFormState): string | null => {
    const normalizedName = normalizeName(form.name)
    if (!normalizedName) {
      return '宝宝小名不能为空'
    }
    if (normalizedName.length > 30) {
      return '宝宝小名不能超过 30 个字符'
    }

    const normalizedFullName = normalizeName(form.fullName)
    if (normalizedFullName.length > 60) {
      return '宝宝大名不能超过 60 个字符'
    }
    return null
  }

  const handleCreate = async () => {
    const validationError = validateForm(createForm)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/user-babies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizeName(createForm.name),
          fullName: normalizeName(createForm.fullName) || null,
          birthDate: createForm.birthDate || null,
          gender: createForm.gender,
          isDefault: createForm.isDefault,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        data?: BabyItem
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || '创建宝宝失败')
      }

      toast.success('宝宝创建成功')
      resetCreateForm()
      await loadBabies()

      if (payload.data?.isDefault && payload.data.id) {
        const nextPath = replaceBabyIdInPathname(pathname, payload.data.id)
        router.replace(nextPath)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建宝宝失败'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditStart = (item: BabyItem) => {
    setEditingBabyId(item.id)
    setEditForm({
      name: item.name,
      fullName: item.fullName || '',
      birthDate: toDateInputValue(item.birthDate),
      gender: item.gender || 'OTHER',
      isDefault: item.isDefault,
    })
  }

  const handleEditCancel = () => {
    setEditingBabyId(null)
    setEditForm(INITIAL_FORM)
  }

  const handleEditSave = async (targetBabyId: string) => {
    const validationError = validateForm(editForm)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath(`/api/app/user-babies/${targetBabyId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizeName(editForm.name),
          fullName: normalizeName(editForm.fullName) || null,
          birthDate: editForm.birthDate || null,
          gender: editForm.gender,
          isDefault: editForm.isDefault,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || '保存失败')
      }

      toast.success('宝宝信息已更新')
      handleEditCancel()
      await loadBabies()

      if (editForm.isDefault) {
        const nextPath = replaceBabyIdInPathname(pathname, targetBabyId)
        router.replace(nextPath)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (targetBabyId: string) => {
    setSaving(true)
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath(`/api/app/user-babies/${targetBabyId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDefault: true,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || '设置默认宝宝失败')
      }

      toast.success('已切换默认宝宝')
      await loadBabies()
      const nextPath = replaceBabyIdInPathname(pathname, targetBabyId)
      router.replace(nextPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : '设置默认宝宝失败'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (
    targetBabyId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || avatarPendingBabyId) {
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过 5MB')
      return
    }

    setAvatarPendingBabyId(targetBabyId)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(withBabyIdOnApiPath('/api/app/baby-profile/avatar', targetBabyId), {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || '上传头像失败')
      }

      toast.success('头像已更新')
      await loadBabies()
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传头像失败'
      toast.error(message)
    } finally {
      setAvatarPendingBabyId(null)
    }
  }

  const handleAvatarDelete = async (targetBabyId: string) => {
    if (avatarPendingBabyId) {
      return
    }

    setAvatarPendingBabyId(targetBabyId)
    try {
      const response = await fetch(withBabyIdOnApiPath('/api/app/baby-profile/avatar', targetBabyId), {
        method: 'DELETE',
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || '删除头像失败')
      }

      toast.success('头像已删除')
      await loadBabies()
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除头像失败'
      toast.error(message)
    } finally {
      setAvatarPendingBabyId(null)
    }
  }

  return (
    <main className="min-h-screen pb-10">
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-1 items-start gap-2.5">
          <BackHomeButton babyId={babyId} />
          <div>
            <h1 className="text-lg font-semibold">宝宝管理</h1>
            <p className="text-xs text-gray-500">头像、大名小名与默认宝宝切换</p>
          </div>
        </div>
        <AppDrawerMenu babyId={babyId} />
      </header>

      <section className="px-4 pt-6 space-y-4">
        <button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="w-full rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left text-sm font-medium text-primary inline-flex items-center gap-2"
          data-testid="babies-add-trigger"
        >
          <Plus size={16} />
          新增宝宝
        </button>

        {showCreateForm && (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-medium text-gray-600">新增宝宝</h2>
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="宝宝小名（昵称，必填）"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              data-testid="babies-create-name"
            />
            <input
              value={createForm.fullName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="宝宝大名（选填）"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              data-testid="babies-create-full-name"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={createForm.birthDate}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    birthDate: event.target.value,
                  }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                data-testid="babies-create-birthdate"
              />
              <select
                value={createForm.gender}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    gender: event.target.value as Gender,
                  }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="OTHER">未指定</option>
                <option value="BOY">男孩</option>
                <option value="GIRL">女孩</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={createForm.isDefault}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    isDefault: event.target.checked,
                  }))
                }
              />
              设为默认宝宝
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                data-testid="babies-create-submit"
              >
                {saving ? '提交中...' : '确认新增'}
              </button>
              <button
                type="button"
                onClick={resetCreateForm}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
            加载宝宝列表中...
          </div>
        ) : babies.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            当前账号还没有绑定宝宝，请先新增一个宝宝。
          </div>
        ) : (
          <div className="space-y-3">
            {babies.map((baby) => {
              const editing = editingBabyId === baby.id
              const displayName = baby.name || baby.fullName || '未命名宝宝'
              const avatarBusy = avatarPendingBabyId === baby.id
              return (
                <article
                  key={baby.id}
                  className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white p-4 shadow-sm"
                  data-testid={`baby-item-${baby.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-100 to-orange-100">
                      {baby.avatarUrl ? (
                        <Image
                          src={baby.avatarUrl}
                          alt={displayName}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <Baby size={20} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-base font-semibold text-gray-800">{displayName}</p>
                      <p className="text-xs text-gray-500">
                        大名：{baby.fullName || '未填写'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {baby.birthDate ? `出生日期：${toDateInputValue(baby.birthDate)}` : '出生日期未填写'}
                      </p>
                    </div>
                    {baby.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                        <Star size={12} />
                        默认
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <input
                      id={`baby-avatar-input-${baby.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void handleAvatarUpload(baby.id, event)}
                      disabled={avatarBusy}
                    />
                    <label
                      htmlFor={`baby-avatar-input-${baby.id}`}
                      className={`inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 ${
                        avatarBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                      }`}
                      data-testid={`baby-avatar-upload-${baby.id}`}
                    >
                      {avatarBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                      {baby.avatarUrl ? '更换头像' : '上传头像'}
                    </label>
                    {baby.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => void handleAvatarDelete(baby.id)}
                        disabled={avatarBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 disabled:opacity-60"
                        data-testid={`baby-avatar-delete-${baby.id}`}
                      >
                        <Trash2 size={14} />
                        删除头像
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <div className="mt-3 space-y-3">
                      <input
                        value={editForm.name}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="宝宝小名（昵称）"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        data-testid={`baby-edit-name-${baby.id}`}
                      />
                      <input
                        value={editForm.fullName}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        placeholder="宝宝大名（选填）"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        data-testid={`baby-edit-full-name-${baby.id}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={editForm.birthDate}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              birthDate: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <select
                          value={editForm.gender}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              gender: event.target.value as Gender,
                            }))
                          }
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="OTHER">未指定</option>
                          <option value="BOY">男孩</option>
                          <option value="GIRL">女孩</option>
                        </select>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={editForm.isDefault}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              isDefault: event.target.checked,
                            }))
                          }
                        />
                        设为默认宝宝
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleEditSave(baby.id)}
                          disabled={saving}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                          data-testid={`baby-edit-save-${baby.id}`}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={handleEditCancel}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(baby)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600"
                        data-testid={`baby-edit-trigger-${baby.id}`}
                      >
                        <Pencil size={14} />
                        编辑
                      </button>
                      {!baby.isDefault && (
                        <button
                          type="button"
                          onClick={() => void handleSetDefault(baby.id)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary disabled:opacity-60"
                          data-testid={`baby-set-default-${baby.id}`}
                        >
                          <CheckCircle2 size={14} />
                          设为默认
                        </button>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
