'use client'

import { useRef } from 'react'
import { Camera, X, Baby, Loader2 } from 'lucide-react'
import { useBabyProfile } from '@/lib/api/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

interface AvatarUploadProps {
  onAvatarChange?: (avatarUrl: string | null) => void
}

export function AvatarUpload({ onAvatarChange }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  
  // Use React Query for baby profile
  const { data: profile, isLoading } = useBabyProfile()
  
  const avatar = profile?.avatarUrl ?? null

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    // 验证文件大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(withCurrentBabyIdOnApiPath('/api/app/baby-profile/avatar'), {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await res.json()
      // Invalidate the baby profile query to refetch
      queryClient.invalidateQueries({ queryKey: ['get', '/baby-profile'] })
      onAvatarChange?.(data.url)
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      alert('上传失败，请重试')
    } finally {
      // 清空 file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeAvatar = async () => {
    try {
      const res = await fetch(withCurrentBabyIdOnApiPath('/api/app/baby-profile/avatar'), {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Delete failed')
      }

      // Invalidate the baby profile query to refetch
      queryClient.invalidateQueries({ queryKey: ['get', '/baby-profile'] })
      onAvatarChange?.(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      alert('删除失败，请重试')
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  if (isLoading) {
    return (
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 border-3 border-white shadow-lg flex items-center justify-center">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {avatar ? (
        <div className="relative group">
          <div 
            className="w-16 h-16 rounded-full overflow-hidden border-3 border-white shadow-lg cursor-pointer"
            onClick={triggerFileInput}
          >
            <img
              src={avatar}
              alt="宝宝头像"
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeAvatar()
            }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            title="删除头像"
          >
            <X size={14} />
          </button>
          <button
            onClick={triggerFileInput}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-md"
            title="更换头像"
          >
            <Camera size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={triggerFileInput}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 border-3 border-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <div className="text-center">
            <Baby size={24} className="text-primary mx-auto" />
            <Camera size={12} className="text-primary/60 mx-auto mt-0.5" />
          </div>
        </button>
      )}
    </div>
  )
}
