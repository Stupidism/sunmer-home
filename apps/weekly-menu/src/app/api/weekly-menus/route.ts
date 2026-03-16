import { NextResponse } from 'next/server'
import { authFailureResponse, requireLogin } from '@/lib/auth/require-user'
import { listWeeklyMenus, saveWeeklyMenu } from '@/lib/db'

type WeeklyPlan = Array<{
  day: string
  meals: Array<{
    label: string
    bigMeat: string
    smallMeat: string
    vegetable: string
  }>
}>

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

function parsePagination(searchParams: URLSearchParams): { limit: number; offset: number } | null {
  const limitRaw = searchParams.get('limit')
  const offsetRaw = searchParams.get('offset')

  const parsedLimit = limitRaw === null ? 20 : Number.parseInt(limitRaw, 10)
  const parsedOffset = offsetRaw === null ? 0 : Number.parseInt(offsetRaw, 10)

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    return null
  }

  if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
    return null
  }

  return { limit: parsedLimit, offset: parsedOffset }
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

export async function GET(request: Request) {
  try {
    const user = await requireLogin()

    const { searchParams } = new URL(request.url)
    const pagination = parsePagination(searchParams)
    if (!pagination) {
      return errorResponse(400, 'INVALID_PAGINATION', 'limit must be 1-500 and offset must be >= 0')
    }

    const items = await listWeeklyMenus(user.id, pagination.limit, pagination.offset)
    return NextResponse.json({
      data: items,
      items,
      meta: {
        limit: pagination.limit,
        offset: pagination.offset,
        count: items.length,
      },
    })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    const errorMessage = toUserFriendlyDbMessage(error, '读取历史菜单失败')
    return errorResponse(500, 'INTERNAL_ERROR', errorMessage)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireLogin()

    const body = (await request.json()) as { weeklyPlan?: unknown; menuPeriod?: unknown }
    if (!isValidWeeklyPlan(body.weeklyPlan)) {
      return errorResponse(422, 'INVALID_WEEKLY_PLAN', 'Invalid weekly plan payload')
    }

    if (typeof body.menuPeriod !== 'string' || body.menuPeriod.trim().length === 0) {
      return errorResponse(422, 'INVALID_MENU_PERIOD', 'menuPeriod is required')
    }

    const saved = await saveWeeklyMenu(user.id, body.weeklyPlan, body.menuPeriod.trim())

    return NextResponse.json(
      {
        data: saved,
        id: saved.id,
        createdAt: saved.createdAt,
        menuPeriod: saved.menuPeriod,
        weeklyPlan: saved.weeklyPlan,
      },
      {
        status: 201,
        headers: {
          Location: `/api/weekly-menus/${saved.id}`,
        },
      }
    )
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    const errorMessage = toUserFriendlyDbMessage(error, '保存菜单失败')
    return errorResponse(500, 'INTERNAL_ERROR', errorMessage)
  }
}
