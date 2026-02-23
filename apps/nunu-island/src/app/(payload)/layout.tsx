import configPromise from '@payload-config'
import '@payloadcms/next/css'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import type { ServerFunctionClient } from 'payload'
import { importMap } from './admin/importMap.js'

export default async function PayloadLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const serverFunction: ServerFunctionClient = async (args) => {
    'use server'

    return handleServerFunctions({
      ...args,
      config: configPromise,
      importMap,
    })
  }

  return RootLayout({
    children,
    config: configPromise,
    importMap,
    serverFunction,
  })
}
