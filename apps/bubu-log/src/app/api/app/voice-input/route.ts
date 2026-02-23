import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { processVoiceInput } from '@/lib/voice-input/process'

// POST: Parse voice input and create activity (session-authenticated)
export async function POST(request: NextRequest) {
  let inputText = ''

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    inputText = typeof body.text === 'string' ? body.text : ''
    const localTime = typeof body.localTime === 'string' ? body.localTime : null

    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })

    const result = await processVoiceInput({
      text: inputText,
      localTime,
      babyId: baby.id,
      userId: user.id,
      confirmationBaseUrl: request.nextUrl.origin,
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.warn('[voice-input][non-success]', {
      status: 500,
      code: 'PROCESSING_ERROR',
      text: inputText,
      details: errorMessage,
      needConfirmation: false,
    })
    console.error('Voice input API failed:', error)

    return NextResponse.json(
      {
        error: '处理语音输入失败',
        details: errorMessage,
        code: 'PROCESSING_ERROR',
      },
      { status: 500 },
    )
  }
}
