const payloadEntry = require.resolve('payload')
const nextEnvPath = require.resolve('@next/env', { paths: [payloadEntry] })
const nextEnv = require(nextEnvPath)

if (nextEnv && typeof nextEnv === 'object' && !('default' in nextEnv)) {
  nextEnv.default = nextEnv
}
