import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getPayloadClient } from '@/lib/payload/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { code: 'INVALID_USERNAME', message: '用户名不能为空' },
        { status: 400 },
      )
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { code: 'INVALID_PASSWORD', message: '密码至少 6 位' },
        { status: 400 },
      )
    }

    const payload = await getPayloadClient()

    const existing = await payload.find({
      collection: 'planner-users',
      where: { username: { equals: username.trim() } },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.totalDocs > 0) {
      return NextResponse.json(
        { code: 'USERNAME_EXISTS', message: '用户名已存在' },
        { status: 409 },
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await payload.create({
      collection: 'planner-users',
      data: {
        username: username.trim(),
        password: hashedPassword,
        name: username.trim(),
        role: 'USER',
      },
      overrideAccess: true,
    })

    return NextResponse.json({ message: '注册成功' }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: '注册失败，请稍后重试' },
      { status: 500 },
    )
  }
}
