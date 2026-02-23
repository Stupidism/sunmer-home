import { NextRequest, NextResponse } from 'next/server'
import { del, put } from '@vercel/blob'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { getPayloadClient } from '@/lib/payload/client'

type BabyDoc = {
  id: string
  avatarUrl?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    const currentBaby = (await payload.findByID({
      collection: 'babies',
      id: baby.id,
      depth: 0,
      overrideAccess: true,
    })) as BabyDoc

    if (currentBaby?.avatarUrl) {
      try {
        await del(currentBaby.avatarUrl)
      } catch (error) {
        console.log('Could not delete old avatar:', error)
      }
    }

    const blob = await put(`avatars/baby-${Date.now()}.${file.type.split('/')[1]}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    const updatedBaby = await payload.update({
      collection: 'babies',
      id: baby.id,
      data: { avatarUrl: blob.url },
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      url: blob.url,
      profile: updatedBaby,
    })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to upload avatar:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const currentBaby = (await payload.findByID({
      collection: 'babies',
      id: baby.id,
      depth: 0,
      overrideAccess: true,
    })) as BabyDoc

    if (currentBaby?.avatarUrl) {
      try {
        await del(currentBaby.avatarUrl)
      } catch (error) {
        console.log('Could not delete avatar from blob:', error)
      }

      await payload.update({
        collection: 'babies',
        id: baby.id,
        data: { avatarUrl: null },
        depth: 0,
        overrideAccess: true,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to delete avatar:', error)
    return NextResponse.json({ error: 'Failed to delete avatar' }, { status: 500 })
  }
}
