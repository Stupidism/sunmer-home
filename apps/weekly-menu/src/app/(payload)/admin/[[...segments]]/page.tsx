import configPromise from '@payload-config'
import { RootPage } from '@payloadcms/next/views'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { importMap } from '../importMap.js'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

const Page = async ({ params, searchParams }: Args) => {
  try {
    return await RootPage({
      config: configPromise,
      importMap,
      params,
      searchParams,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }

    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Payload Admin 未完成初始化</h1>
        <p className="mt-4 text-sm text-slate-600">
          当前数据库缺少 Payload 所需表。请临时使用
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">PAYLOAD_DB_PUSH=true</code>
          和
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs">
            PAYLOAD_ALLOW_DESTRUCTIVE_PUSH=true
          </code>
          启动一次，建表完成后再改回普通启动。
        </p>
      </main>
    )
  }
}

export default Page
