import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

let cachedPayload: Promise<Payload> | null = null

export function getPayloadClient(): Promise<Payload> {
  if (!cachedPayload) {
    cachedPayload = getPayload({ config: configPromise })
  }

  return cachedPayload
}
