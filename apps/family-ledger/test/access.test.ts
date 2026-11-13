import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dashboardAccess } from '../src/lib/access'

test('dashboard data is denied without a session', () => {
  const result = dashboardAccess(null, { databaseUrl: true, authSecret: true })
  assert.equal(result.allowed, false)
  assert.equal(result.status, 401)
})

test('incomplete runtime configuration is fail-closed', () => {
  const result = dashboardAccess({ id: '1' }, { databaseUrl: false, authSecret: true })
  assert.equal(result.allowed, false)
  assert.equal(result.status, 503)
})
