import { NextResponse } from 'next/server'
import { authFailureResponse, requireLogin } from '@/lib/auth/require-user'
import {
  createUserRecipeSubmission,
  existsDuplicateRecipeName,
  isValidUserRecipeCategory,
  listUserRecipeSubmissions,
  type UserRecipeStatus,
} from '@/lib/user-recipes-db'

type CreateRecipeBody = {
  name?: unknown
  category?: unknown
  description?: unknown
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

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: Request) {
  try {
    const user = await requireLogin()
    const { searchParams } = new URL(request.url)

    const usable = searchParams.get('usable') === '1'
    const includeStatuses: UserRecipeStatus[] | undefined = usable
      ? ['pending', 'approved']
      : undefined

    const items = await listUserRecipeSubmissions({
      userId: user.id,
      includeStatuses,
    })

    return NextResponse.json({
      data: items,
      items,
      meta: {
        count: items.length,
      },
    })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    return errorResponse(500, 'INTERNAL_ERROR', '读取用户菜谱失败')
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireLogin()
    const body = (await request.json()) as CreateRecipeBody

    const name = normalizeText(body.name)
    const category = normalizeText(body.category)
    const descriptionRaw = normalizeText(body.description)

    if (!name || name.length < 2 || name.length > 50) {
      return errorResponse(422, 'INVALID_NAME', '菜谱名称长度需在 2 到 50 之间')
    }

    if (!isValidUserRecipeCategory(category)) {
      return errorResponse(422, 'INVALID_CATEGORY', 'category must be one of big-meat|small-meat|vegetable')
    }

    const duplicated = await existsDuplicateRecipeName({
      userId: user.id,
      name,
    })

    if (duplicated) {
      return errorResponse(409, 'DUPLICATE_RECIPE_NAME', '菜谱名称重复，请使用不同名称')
    }

    const created = await createUserRecipeSubmission({
      userId: user.id,
      name,
      category,
      description: descriptionRaw || null,
    })

    return NextResponse.json(
      {
        data: created,
      },
      { status: 201 }
    )
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    return errorResponse(500, 'INTERNAL_ERROR', '提交菜谱失败，请稍后重试')
  }
}
