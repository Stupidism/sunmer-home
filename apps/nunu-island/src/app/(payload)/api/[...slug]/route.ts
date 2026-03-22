import configPromise from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'
import type { NextRequest } from 'next/server'

type RouteContext = {
  params: Promise<{
    slug?: string[]
  }>
}

function withRequestLogging(
  method: string,
  handler: (request: NextRequest, context: RouteContext) => Promise<Response>
) {
  return async (request: NextRequest, context: RouteContext): Promise<Response> => {
    const startedAt = Date.now()
    const pathWithQuery = `${request.nextUrl.pathname}${request.nextUrl.search}`

    try {
      const response = await handler(request, context)
      const durationMs = Date.now() - startedAt
      console.info(
        `[payload-api] method=${method} path=${pathWithQuery} status=${response.status} durationMs=${durationMs}`
      )
      return response
    } catch (error) {
      const durationMs = Date.now() - startedAt
      console.error(
        `[payload-api] method=${method} path=${pathWithQuery} status=500 durationMs=${durationMs} error=${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }
}

export const GET = withRequestLogging('GET', REST_GET(configPromise))
export const POST = withRequestLogging('POST', REST_POST(configPromise))
export const DELETE = withRequestLogging('DELETE', REST_DELETE(configPromise))
export const PATCH = withRequestLogging('PATCH', REST_PATCH(configPromise))
export const PUT = withRequestLogging('PUT', REST_PUT(configPromise))
export const OPTIONS = withRequestLogging('OPTIONS', REST_OPTIONS(configPromise))
