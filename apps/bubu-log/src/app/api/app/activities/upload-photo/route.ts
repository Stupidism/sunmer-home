import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'

// POST - 上传活动照片（如大便照片）
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as string || 'activity'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // 验证文件大小（最大10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // 上传到 Vercel Blob
    const blob = await put(`${category}/${Date.now()}.${file.type.split('/')[1]}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    return NextResponse.json({
      url: blob.url,
    })
  } catch (error) {
    console.error('Failed to upload photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}

// DELETE - 删除照片
export async function DELETE(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      )
    }

    try {
      await del(url)
    } catch (e) {
      console.log('Could not delete photo from blob:', e)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    )
  }
}

