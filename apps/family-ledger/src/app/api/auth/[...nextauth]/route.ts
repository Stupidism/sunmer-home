import { authSecretConfigured, handlers } from '@/server/auth'
import { NextRequest, NextResponse } from 'next/server'

async function handle(request: NextRequest, method: (request: NextRequest) => Promise<Response>) {
  if (!authSecretConfigured) {
    return NextResponse.json({ error: 'authentication is not configured' }, { status: 503 })
  }
  return method(request)
}

export const GET = (request: NextRequest) => handle(request, handlers.GET)
export const POST = (request: NextRequest) => handle(request, handlers.POST)
