'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { PoopColor, PeeAmount, PoopColorLabels, PeeAmountLabels, PoopColorStyles } from '@/types/activity'
import { TimeAdjuster } from '../TimeAdjuster'
import { Droplet, Circle, Camera, X, Loader2, Check } from 'lucide-react'
import { withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

const STORAGE_KEY = 'diaper_form_preferences'

interface DiaperFormPreferences {
  rememberSelection: boolean
  defaultHasPee: boolean
  defaultPeeAmount: PeeAmount
  defaultPoopColor: PoopColor
}

const DEFAULT_PREFERENCES: DiaperFormPreferences = {
  rememberSelection: false,
  defaultHasPee: true,
  defaultPeeAmount: PeeAmount.LARGE,
  defaultPoopColor: PoopColor.YELLOW,
}

interface DiaperFormProps {
  onSubmit: (data: {
    startTime: Date
    hasPoop: boolean
    hasPee: boolean
    poopColor?: PoopColor
    poopPhotoUrl?: string
    peeAmount?: PeeAmount
  }) => void
  onCancel: () => void
  initialValues?: {
    startTime?: Date
    hasPoop?: boolean
    hasPee?: boolean
    poopColor?: PoopColor
    poopPhotoUrl?: string
    peeAmount?: PeeAmount
  }
  isEditing?: boolean
  /** 隐藏大小便选择（从首页按钮已经确定了类型） */
  hideTypeSelection?: boolean
}

export function DiaperForm({ onSubmit, onCancel, initialValues, isEditing, hideTypeSelection }: DiaperFormProps) {
  const [preferences, setPreferences] = useState<DiaperFormPreferences>(DEFAULT_PREFERENCES)
  const [startTime, setStartTime] = useState(initialValues?.startTime || new Date())
  const [hasPoop, setHasPoop] = useState(initialValues?.hasPoop ?? false)
  const [hasPee, setHasPee] = useState(initialValues?.hasPee ?? true) // 默认选中小便
  const [poopColor, setPoopColor] = useState<PoopColor>(initialValues?.poopColor || PoopColor.YELLOW) // 默认黄色
  const [peeAmount, setPeeAmount] = useState<PeeAmount>(initialValues?.peeAmount || PeeAmount.LARGE) // 默认多
  const [poopPhotoUrl, setPoopPhotoUrl] = useState<string | null>(initialValues?.poopPhotoUrl || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载保存的偏好设置（仅在新建时）
  useEffect(() => {
    if (isEditing) return // 编辑模式不加载偏好
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const savedPrefs = JSON.parse(saved) as DiaperFormPreferences
        setPreferences(savedPrefs)
        if (savedPrefs.rememberSelection && !initialValues) {
          setHasPee(savedPrefs.defaultHasPee)
          setPeeAmount(savedPrefs.defaultPeeAmount)
          setPoopColor(savedPrefs.defaultPoopColor)
        }
      }
    } catch (e) {
      console.error('Failed to load preferences:', e)
    }
  }, [isEditing, initialValues])

  // 保存偏好设置
  const savePreferences = () => {
    const newPrefs: DiaperFormPreferences = {
      rememberSelection: true,
      defaultHasPee: hasPee,
      defaultPeeAmount: peeAmount,
      defaultPoopColor: poopColor,
    }
    setPreferences(newPrefs)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs))
  }

  // 清除偏好设置
  const clearPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
    localStorage.removeItem(STORAGE_KEY)
  }

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('图片大小不能超过 10MB')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'poop')

      const res = await fetch(withCurrentBabyIdOnApiPath('/api/app/activities/upload-photo'), {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      setPoopPhotoUrl(data.url)
    } catch (error) {
      console.error('Failed to upload photo:', error)
      alert('上传失败，请重试')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removePhoto = async () => {
    if (!poopPhotoUrl) return

    try {
      await fetch(withCurrentBabyIdOnApiPath('/api/app/activities/upload-photo'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: poopPhotoUrl }),
      })
    } catch (e) {
      console.log('Failed to delete photo:', e)
    }

    setPoopPhotoUrl(null)
  }

  const handleSubmit = () => {
    if (!hasPoop && !hasPee) return
    onSubmit({
      startTime,
      hasPoop,
      hasPee,
      poopColor: hasPoop ? poopColor : undefined,
      poopPhotoUrl: hasPoop ? (poopPhotoUrl || undefined) : undefined,
      peeAmount: hasPee ? peeAmount : undefined,
    })
  }

  const canSubmit = (hasPoop || hasPee) && (!hasPoop || poopColor) && (!hasPee || peeAmount)

  return (
    <div className="space-y-6 animate-fade-in">
      <TimeAdjuster time={startTime} onTimeChange={setStartTime} />

      {/* 大小便选择 - 如果从首页按钮进入则隐藏 */}
      <div className="space-y-4">
        {!hideTypeSelection && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setHasPoop(!hasPoop)}
              className={`p-4 rounded-2xl text-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                hasPoop
                  ? 'bg-amber-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Circle size={20} className="fill-current" />
              大便
            </button>
            <button
              onClick={() => setHasPee(!hasPee)}
              className={`p-4 rounded-2xl text-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                hasPee
                  ? 'bg-yellow-400 text-white shadow-lg scale-105'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Droplet size={20} />
              小便
            </button>
          </div>
        )}

        {/* 大便颜色选择 */}
        {hasPoop && (
          <div className="animate-fade-in space-y-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">大便颜色</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PoopColorLabels).map(([color, label]) => (
                <button
                  key={color}
                  onClick={() => setPoopColor(color as PoopColor)}
                  className={`p-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                    poopColor === color
                      ? 'ring-2 ring-primary ring-offset-2 scale-105'
                      : 'hover:scale-102'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${PoopColorStyles[color as PoopColor]}`} />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* 大便照片上传 */}
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                大便照片 <span className="text-gray-400">(可选)</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              {poopPhotoUrl ? (
                <div className="relative inline-block">
                  <Image
                    src={poopPhotoUrl}
                    alt="大便照片"
                    width={96}
                    height={96}
                    unoptimized
                    className="w-24 h-24 object-cover rounded-xl"
                  />
                  <button
                    onClick={removePhoto}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      <Camera size={24} />
                      <span className="text-xs">添加照片</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 小便量选择 */}
        {hasPee && (
          <div className="animate-fade-in">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">小便量</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PeeAmountLabels).map(([amount, label]) => (
                <button
                  key={amount}
                  onClick={() => setPeeAmount(amount as PeeAmount)}
                  className={`p-4 rounded-xl font-semibold transition-all flex flex-col items-center gap-1 ${
                    peeAmount === amount
                      ? 'bg-yellow-400 text-white shadow-lg scale-105'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex gap-0.5">
                    <Droplet size={16} />
                    {amount !== 'SMALL' && <Droplet size={16} />}
                    {amount === 'LARGE' && <Droplet size={16} />}
                  </div>
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 记住选择 */}
      <button
        onClick={() => preferences.rememberSelection ? clearPreferences() : savePreferences()}
        className="flex items-center gap-2 py-2 px-1 text-base transition-all"
      >
        {preferences.rememberSelection ? (
          <Check size={20} className="text-green-500" />
        ) : (
          <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600" />
        )}
        <span className={preferences.rememberSelection ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
          记住当前选择
        </span>
      </button>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-3 pt-4">
        <button
          onClick={onCancel}
          className="p-4 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-lg"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`p-4 rounded-2xl font-semibold text-lg transition-all ${
            canSubmit
              ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isEditing ? '保存修改' : '确认记录'}
        </button>
      </div>
    </div>
  )
}
