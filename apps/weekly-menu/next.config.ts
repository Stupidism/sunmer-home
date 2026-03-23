import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@bubu-log/ui'],
}

export default withPayload(nextConfig)
