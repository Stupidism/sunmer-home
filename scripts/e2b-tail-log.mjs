import process from 'node:process'
import { Sandbox } from 'e2b'

function printUsage() {
  console.log(`Usage:
  pnpm sandbox:logs -- <sandboxId> [--file /tmp/e2b-app.log] [--lines 200] [--once]

Examples:
  pnpm sandbox:logs -- i7s305f697z0f206su27r
  pnpm sandbox:logs -- i7s305f697z0f206su27r --file /tmp/e2b-app.log --lines 300
  pnpm sandbox:logs -- i7s305f697z0f206su27r --once

Required env:
  E2B_API_KEY=<your key>
`)
}

function escapeShell(value) {
  return value.replace(/'/g, "'\"'\"'")
}

function parseArgs(argv) {
  let sandboxId = null
  let filePath = '/tmp/e2b-app.log'
  let lines = 200
  let once = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }

    if (arg === '--file') {
      filePath = argv[i + 1] || filePath
      i += 1
      continue
    }

    if (arg === '--lines') {
      const parsed = Number(argv[i + 1])
      if (Number.isFinite(parsed) && parsed > 0) {
        lines = parsed
      }
      i += 1
      continue
    }

    if (arg === '--once') {
      once = true
      continue
    }

    if (!arg.startsWith('--') && !sandboxId) {
      sandboxId = arg
    }
  }

  return { sandboxId, filePath, lines, once }
}

async function main() {
  const { sandboxId, filePath, lines, once } = parseArgs(process.argv.slice(2))

  if (!sandboxId) {
    console.error('Missing required sandboxId.')
    printUsage()
    process.exit(1)
  }

  if (!process.env.E2B_API_KEY) {
    console.error('Missing E2B_API_KEY in environment.')
    process.exit(1)
  }

  console.log(`[sandbox:logs] connecting sandbox=${sandboxId}`)
  const sandbox = await Sandbox.connect(sandboxId)
  const escapedPath = escapeShell(filePath)
  const escapedLines = Math.max(1, Math.floor(lines))
  const command = once
    ? `bash -lc 'if [ -f '\''${escapedPath}'\'' ]; then tail -n ${escapedLines} '\''${escapedPath}'\''; else echo "log file not found: ${filePath}" >&2; exit 1; fi'`
    : `bash -lc 'touch '\''${escapedPath}'\'' && tail -n ${escapedLines} -F '\''${escapedPath}'\'''`

  console.log(
    `[sandbox:logs] ${once ? 'reading snapshot' : 'streaming'} file=${filePath} lines=${escapedLines}`
  )

  await sandbox.commands.run(command, {
    timeoutMs: 0,
    onStdout: (data) => process.stdout.write(data),
    onStderr: (data) => process.stderr.write(data),
  })
}

main().catch((error) => {
  console.error(`[sandbox:logs] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
