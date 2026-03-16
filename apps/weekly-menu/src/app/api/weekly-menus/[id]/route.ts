import { NextResponse } from 'next/server'
import { authFailureResponse, requireLogin } from '@/lib/auth/require-user'
import { deleteWeeklyMenu, getWeeklyMenuById, updateWeeklyMenu } from '@/lib/db'

type WeeklyPlan = Array<{
  day: string
  meals: Array<{
    label: string
    bigMeat: string
    smallMeat: string
    vegetable: string
  }>
}>

type RouteParams = {
  params: Promise<{ id: string }> | { id: string }
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
      message,
    },
    { status }
  )
}

function isValidId(id: string): boolean {
  return /^\d+$/.test(id)
}

function toUserFriendlyDbMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }

  const message = error.message.toLowerCase()
  const looksLikeDbConnectionIssue =
    message.includes('postgres') ||
    message.includes('database') ||
    message.includes('tls') ||
    message.includes('socket') ||
    message.includes('econn') ||
    message.includes('timeout') ||
    message.includes('missing postgresql config')

  if (looksLikeDbConnectionIssue) {
    return '数据库连接失败，请检查本地环境变量与数据库状态'
  }

  return fallback
}

function isValidWeeklyPlan(value: unknown): value is WeeklyPlan {
  if (!Array.isArray(value)) {
    return false
  }

  return value.every((day) => {
    if (!day || typeof day !== 'object') {
      return false
    }

    const dayRecord = day as { day?: unknown; meals?: unknown }
    if (typeof dayRecord.day !== 'string' || !Array.isArray(dayRecord.meals)) {
      return false
    }

    return dayRecord.meals.every((meal) => {
      if (!meal || typeof meal !== 'object') {
        return false
      }

      const mealRecord = meal as {
        label?: unknown
        bigMeat?: unknown
        smallMeat?: unknown
        vegetable?: unknown
      }

      return (
        typeof mealRecord.label === 'string' &&
        typeof mealRecord.bigMeat === 'string' &&
        typeof mealRecord.smallMeat === 'string' &&
        typeof mealRecord.vegetable === 'string'
      )
    })
  })
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const user = await requireLogin()

    const { id } = await Promise.resolve(params)
    if (!isValidId(id)) {
      return errorResponse(400, 'INVALID_ID', 'id must be a numeric string')
    }

    const item = await getWeeklyMenuById(user.id, id)

    if (!item) {
      return errorResponse(404, 'NOT_FOUND', '记录不存在')
    }

    return NextResponse.json({ data: item })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    return errorResponse(500, 'INTERNAL_ERROR', toUserFriendlyDbMessage(error, '读取失败'))
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await requireLogin()

    const { id } = await Promise.resolve(params)
    if (!isValidId(id)) {
      return errorResponse(400, 'INVALID_ID', 'id must be a numeric string')
    }

    const body = (await request.json()) as { weeklyPlan?: unknown; menuPeriod?: unknown }
    if (!isValidWeeklyPlan(body.weeklyPlan)) {
      return errorResponse(422, 'INVALID_WEEKLY_PLAN', 'Invalid weekly plan payload')
    }

    if (typeof body.menuPeriod !== 'string' || body.menuPeriod.trim().length === 0) {
      return errorResponse(422, 'INVALID_MENU_PERIOD', 'menuPeriod is required')
    }

    const updated = await updateWeeklyMenu(user.id, id, {
      weeklyPlan: body.weeklyPlan,
      menuPeriod: body.menuPeriod.trim(),
    })

    if (!updated) {
      return errorResponse(404, 'NOT_FOUND', '记录不存在')
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    return errorResponse(500, 'INTERNAL_ERROR', toUserFriendlyDbMessage(error, '更新失败'))
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireLogin()

    const { id } = await Promise.resolve(params)
    if (!isValidId(id)) {
      return errorResponse(400, 'INVALID_ID', 'id must be a numeric string')
    }

    const body = (await request.json()) as { weeklyPlan?: unknown; menuPeriod?: unknown }

    const updates: { weeklyPlan?: WeeklyPlan; menuPeriod?: string } = {}

    if (body.weeklyPlan !== undefined) {
      if (!isValidWeeklyPlan(body.weeklyPlan)) {
        return errorResponse(422, 'INVALID_WEEKLY_PLAN', 'Invalid weekly plan payload')
      }
      updates.weeklyPlan = body.weeklyPlan
    }

    if (body.menuPeriod !== undefined) {
      if (typeof body.menuPeriod !== 'string' || body.menuPeriod.trim().length === 0) {
        return errorResponse(422, 'INVALID_MENU_PERIOD', 'menuPeriod must be a non-empty string')
      }
      updates.menuPeriod = body.menuPeriod.trim()
    }

    if (!updates.weeklyPlan && !updates.menuPeriod) {
      return errorResponse(400, 'NO_UPDATABLE_FIELDS', 'No valid fields to update')
    }

    const updated = await updateWeeklyMenu(user.id, id, updates)
    if (!updated) {
      return errorResponse(404, 'NOT_FOUND', '记录不存在')
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    return errorResponse(500, 'INTERNAL_ERROR', toUserFriendlyDbMessage(error, '更新失败'))
  }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  try {
    const user = await requireLogin()

    const { id } = await Promise.resolve(params)
    if (!isValidId(id)) {
      return errorResponse(400, 'INVALID_ID', 'id must be a numeric string')
    }

    const deleted = await deleteWeeklyMenu(user.id, id)

    if (!deleted) {
      return errorResponse(404, 'NOT_FOUND', '记录不存在')
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    return errorResponse(500, 'INTERNAL_ERROR', toUserFriendlyDbMessage(error, '删除失败'))
  }
}
