import { NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { authFailureResponse, requireUser } from '@/lib/auth/get-current-baby'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'
import type { ActivityDoc, AuditLogDoc, BabyDoc, BabyUserDoc, DailyStatDoc } from '@/lib/payload/models'

type PaginationResult<T> = {
  docs: T[]
  hasNextPage?: boolean
}

async function fetchAllDocs<T>(args: {
  collection: string
  where?: Record<string, unknown>
  limit?: number
}): Promise<T[]> {
  const payload = await getPayloadClient()
  const limit = args.limit ?? 200
  let page = 1
  const docs: T[] = []

  while (true) {
    const result = (await payload.find({
      collection: args.collection,
      where: args.where,
      limit,
      page,
      depth: 0,
      overrideAccess: true,
    })) as PaginationResult<T>

    docs.push(...(result.docs || []))
    if (!result.hasNextPage) {
      break
    }
    page += 1
  }

  return docs
}

async function deleteBlob(url?: string | null) {
  if (!url) {
    return
  }
  try {
    await del(url)
  } catch (error) {
    console.warn('Failed to delete blob:', error)
  }
}

export async function DELETE() {
  let auditPayload: Awaited<ReturnType<typeof getPayloadClient>> | null = null
  let auditUserId: string | null = null
  try {
    const user = await requireUser()
    auditUserId = user.id
    const payload = await getPayloadClient()
    auditPayload = payload

    const bindings = (await fetchAllDocs<BabyUserDoc>({
      collection: 'baby-users',
      where: {
        userId: {
          equals: user.id,
        },
      },
    })) as BabyUserDoc[]

    const babyIds = Array.from(
      new Set(
        bindings
          .map((binding) => (typeof binding.babyId === 'string' ? binding.babyId : binding.babyId?.id))
          .filter((id): id is string => Boolean(id))
      )
    )

    const allBindings = babyIds.length
      ? ((await fetchAllDocs<BabyUserDoc>({
          collection: 'baby-users',
          where: {
            babyId: {
              in: babyIds,
            },
          },
        })) as BabyUserDoc[])
      : []

    const babyBindingMap = new Map<string, BabyUserDoc[]>()
    for (const binding of allBindings) {
      const babyId = typeof binding.babyId === 'string' ? binding.babyId : binding.babyId?.id
      if (!babyId) continue
      if (!babyBindingMap.has(babyId)) {
        babyBindingMap.set(babyId, [])
      }
      babyBindingMap.get(babyId)?.push(binding)
    }

    for (const babyId of babyIds) {
      const babyBindings = babyBindingMap.get(babyId) || []
      const otherUsers = babyBindings.filter((binding) => {
        const userId = typeof binding.userId === 'string' ? binding.userId : binding.userId?.id
        return userId && userId !== user.id
      })

      if (otherUsers.length > 0) {
        for (const binding of babyBindings) {
          const userId = typeof binding.userId === 'string' ? binding.userId : binding.userId?.id
          if (userId !== user.id) continue
          await payload.delete({
            collection: 'baby-users',
            id: binding.id,
            depth: 0,
            overrideAccess: true,
          })
        }
        continue
      }

      const baby = await payload.findByID({
        collection: 'babies',
        id: babyId,
        depth: 0,
        overrideAccess: true,
      }).catch(() => null) as BabyDoc | null

      if (baby?.avatarUrl) {
        await deleteBlob(baby.avatarUrl)
      }

      const activities = (await fetchAllDocs<ActivityDoc>({
        collection: 'activities',
        where: {
          babyId: {
            equals: babyId,
          },
        },
      })) as ActivityDoc[]

      for (const activity of activities) {
        await deleteBlob(activity.poopPhotoUrl)
        await payload.delete({
          collection: 'activities',
          id: activity.id,
          depth: 0,
          overrideAccess: true,
        })
      }

      const dailyStats = (await fetchAllDocs<DailyStatDoc>({
        collection: 'daily-stats',
        where: {
          babyId: {
            equals: babyId,
          },
        },
      })) as DailyStatDoc[]

      for (const stat of dailyStats) {
        await payload.delete({
          collection: 'daily-stats',
          id: stat.id,
          depth: 0,
          overrideAccess: true,
        })
      }

      const babyAudits = (await fetchAllDocs<AuditLogDoc>({
        collection: 'audit-logs',
        where: {
          babyId: {
            equals: babyId,
          },
        },
      })) as AuditLogDoc[]

      for (const audit of babyAudits) {
        await payload.delete({
          collection: 'audit-logs',
          id: audit.id,
          depth: 0,
          overrideAccess: true,
        })
      }

      for (const binding of babyBindings) {
        await payload.delete({
          collection: 'baby-users',
          id: binding.id,
          depth: 0,
          overrideAccess: true,
        })
      }

      await payload.delete({
        collection: 'babies',
        id: babyId,
        depth: 0,
        overrideAccess: true,
      })
    }

    const userAudits = (await fetchAllDocs<AuditLogDoc>({
      collection: 'audit-logs',
      where: {
        userId: {
          equals: user.id,
        },
      },
    })) as AuditLogDoc[]

    for (const audit of userAudits) {
      await payload.delete({
        collection: 'audit-logs',
        id: audit.id,
        depth: 0,
        overrideAccess: true,
      })
    }

    try {
      await createAuditLog(payload, {
        action: 'DELETE',
        inputMethod: 'TEXT',
        description: '用户自助删除账号与数据',
        userId: user.id,
      })
    } catch (logError) {
      console.warn('Failed to write deletion audit log:', logError)
    }

    await payload.delete({
      collection: 'app-users',
      id: user.id,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (auditPayload && auditUserId) {
      await createAuditLog(auditPayload, {
        action: 'DELETE',
        inputMethod: 'TEXT',
        description: '用户自助删除账号与数据失败',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        userId: auditUserId,
      }).catch(() => undefined)
    }
    const failureResponse = authFailureResponse(error)
    if (failureResponse) {
      return failureResponse
    }

    console.error('Failed to delete account:', error)
    return NextResponse.json({ error: '删除账号失败，请稍后重试' }, { status: 500 })
  }
}
