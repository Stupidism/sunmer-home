import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function getPayloadClient() {
  return getPayload({ config: configPromise })
}
