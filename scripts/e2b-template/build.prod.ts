import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const name = process.env.E2B_TEMPLATE_NAME || 'bubu-preview-large'
const cpuCount = envInt('E2B_TEMPLATE_CPU', 4)
const memoryMB = envInt('E2B_TEMPLATE_MEMORY_MB', 4096)

async function main(): Promise<void> {
  const result = await Template.build(template, name, {
    cpuCount,
    memoryMB,
    onBuildLogs: defaultBuildLogger(),
  })

  console.log('')
  console.log('Template build completed.')
  console.log(`name=${name}`)
  console.log(`cpuCount=${cpuCount}`)
  console.log(`memoryMB=${memoryMB}`)
  console.log(`templateID=${result.templateID}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
