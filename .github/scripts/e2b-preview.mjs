import { Sandbox } from 'e2b'
import { appendFileSync } from 'node:fs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseOptionalInt(value, fallback) {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const e2bRequestTimeoutMs = parseOptionalInt(process.env.E2B_REQUEST_TIMEOUT_MS, 60_000)

async function withRequestTimeout(task, label) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[e2b][request-timeout] ${label} exceeded ${e2bRequestTimeoutMs}ms`))
    }, e2bRequestTimeoutMs)
  })

  try {
    return await Promise.race([task, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}
function setGithubOutput(key, value) {
  const output = process.env.GITHUB_OUTPUT
  if (!output) return

  if (typeof value === 'string' && !value.includes('\n')) {
    appendFileSync(output, `${key}=${value}\n`)
    return
  }

  appendFileSync(output, `${key}<<EOF\n${String(value)}\nEOF\n`)
}

function parseDotenv(content) {
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const idx = trimmed.indexOf('=')
    if (idx <= 0) {
      continue
    }
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function loadPreviewEnvFromBase64() {
  const b64 = process.env.E2B_PREVIEW_ENV_B64
  if (!b64) {
    return {}
  }
  const decoded = Buffer.from(b64, 'base64').toString('utf8')
  return parseDotenv(decoded)
}

async function listSandboxesByMetadata(metadata) {
  const paginator = Sandbox.list({ query: { metadata } })
  const all = []

  while (paginator.hasNext) {
    const page = await withRequestTimeout(paginator.nextItems(), 'Sandbox.list.nextItems')
    all.push(...page)
  }

  return all
}

async function killSandboxes(metadata) {
  const sandboxes = await listSandboxesByMetadata(metadata)
  for (const sandbox of sandboxes) {
    await withRequestTimeout(Sandbox.kill(sandbox.sandboxId), `Sandbox.kill(${sandbox.sandboxId})`)
  }
  return sandboxes.length
}

function escapeShell(value) {
  return value.replace(/'/g, "'\"'\"'")
}

function resolveInstallCommand(appPath) {
  const customFilters = process.env.E2B_PNPM_FILTERS
  if (customFilters) {
    const filters = customFilters
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (filters.length > 0) {
      const filterFlags = filters.map((filter) => `--filter ${filter}`).join(' ')
      return `pnpm install --frozen-lockfile ${filterFlags} --child-concurrency=1 --network-concurrency=2`
    }
  }

  if (appPath === 'apps/nunu-island') {
    return 'pnpm install --frozen-lockfile --filter nunu-island --filter @bubu-log/ui --filter @bubu-log/typescript-config --child-concurrency=1 --network-concurrency=2'
  }

  return 'pnpm install --frozen-lockfile --filter bubu-log --filter @bubu-log/ui --filter @bubu-log/log-ui --filter @bubu-log/typescript-config --child-concurrency=1 --network-concurrency=2'
}

function resolveMigrationCommand(appPath) {
  if (appPath === 'apps/nunu-island') {
    return "NODE_OPTIONS='--import tsx -r ./scripts/shims/next-env-default.cjs' pnpm payload migrate"
  }

  if (appPath === 'apps/wedding-invite') {
    return 'pnpm db:migrate'
  }

  return null
}

const logFile = process.env.E2B_LOG_FILE

function writeLog(line) {
  console.log(line)
  if (logFile) {
    appendFileSync(logFile, `${line}\n`)
  }
}

async function runCommandWithLogs(sandbox, label, cmd, opts = {}) {
  writeLog(`[e2b][start] ${label}: ${cmd}`)
  try {
    const result = await sandbox.commands.run(cmd, {
      ...opts,
      onStdout: (data) => {
        const lines = data.split('\n').filter(Boolean)
        for (const line of lines) {
          writeLog(`[e2b][stdout][${label}] ${line}`)
        }
      },
      onStderr: (data) => {
        const lines = data.split('\n').filter(Boolean)
        for (const line of lines) {
          writeLog(`[e2b][stderr][${label}] ${line}`)
        }
      },
    })
    writeLog(`[e2b][done] ${label}: exit=${result.exitCode}`)
    return result
  } catch (error) {
    writeLog(`[e2b][fail] ${label}: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

async function runBestEffortCommandWithLogs(sandbox, label, cmd, opts = {}) {
  try {
    await runCommandWithLogs(sandbox, label, cmd, opts)
  } catch (error) {
    writeLog(`[e2b][warn] ${label} failed during diagnostics: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function collectAppDiagnostics(sandbox, appLogPath, appPidPath, port) {
  const escapedAppLogPath = escapeShell(appLogPath)
  const escapedAppPidPath = escapeShell(appPidPath)

  writeLog('[e2b][diagnostics] collecting app process, port, and log snapshots')
  await runBestEffortCommandWithLogs(
    sandbox,
    'diagnostics-app-pid',
    `bash -lc 'if [ -f '\''${escapedAppPidPath}'\'' ]; then APP_PID=$(cat '\''${escapedAppPidPath}'\'' 2>/dev/null || true); echo "[e2b][diagnostics] app-pid=\${APP_PID}"; if [ -n "\${APP_PID}" ]; then ps -p "\${APP_PID}" -o pid=,ppid=,stat=,etime=,comm=; fi; else echo "[e2b][diagnostics] app pid file missing"; fi'`
  )
  await runBestEffortCommandWithLogs(
    sandbox,
    'diagnostics-process-list',
    "bash -lc 'ps -eo pid,ppid,stat,etime,command | head -n 200'"
  )
  await runBestEffortCommandWithLogs(
    sandbox,
    'diagnostics-port-listeners',
    `bash -lc '(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null || true) | grep ":${port}\\b" || true'`
  )
  await runBestEffortCommandWithLogs(
    sandbox,
    'diagnostics-app-log-tail',
    `bash -lc 'if [ -f '\''${escapedAppLogPath}'\'' ]; then echo "[e2b][diagnostics] app log tail"; tail -n 200 '\''${escapedAppLogPath}'\''; else echo "[e2b][diagnostics] app log file not found: ${appLogPath}"; fi'`
  )
}

async function createPreview() {
  const repo = requireEnv('GITHUB_REPOSITORY')
  const prNumber = requireEnv('PR_NUMBER')
  const headRef = requireEnv('PR_HEAD_REF')
  const headSha = requireEnv('PR_HEAD_SHA')
  const githubToken = requireEnv('GH_TOKEN')

  const appPath = process.env.E2B_APP_PATH || 'apps/bubu-log'
  const appId = process.env.E2B_APP_ID || appPath.replace(/^apps\//, '')
  const appName = process.env.E2B_APP_NAME || appId
  const port = parseOptionalInt(process.env.E2B_APP_PORT, 1030)
  const timeoutMs = parseOptionalInt(process.env.E2B_TIMEOUT_MS, 60 * 60 * 1000)
  const template = process.env.E2B_TEMPLATE
  const pnpmInstallCommand = resolveInstallCommand(appPath)
  const migrationCommand = resolveMigrationCommand(appPath)

  const metadata = {
    owner: 'github-actions',
    purpose: 'pr-preview',
    repo,
    pr: prNumber,
    app: appId,
  }

  const killed = await killSandboxes(metadata)
  writeLog(`Killed existing sandboxes: ${killed}`)

  const sandbox = template
    ? await withRequestTimeout(Sandbox.create(template, { timeoutMs, metadata }), 'Sandbox.create(template)')
    : await withRequestTimeout(Sandbox.create({ timeoutMs, metadata }), 'Sandbox.create(default)')

  const previewUrl = `https://${sandbox.getHost(port)}`
  const appEnv = {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    PORT: String(port),
    NEXTAUTH_URL: previewUrl,
    AUTH_TRUST_HOST: 'true',
    ...loadPreviewEnvFromBase64(),
  }

  if (appPath === 'apps/nunu-island') {
    appEnv.PAYLOAD_DB_PUSH = 'true'
    appEnv.PAYLOAD_ALLOW_DESTRUCTIVE_PUSH = 'true'
  }
  const appLogPath = '/tmp/e2b-app.log'
  const appPidPath = '/tmp/e2b-app.pid'
  const escapedAppLogPath = escapeShell(appLogPath)
  const escapedAppPidPath = escapeShell(appPidPath)
  writeLog(`[e2b][config] requestTimeoutMs=${e2bRequestTimeoutMs}`)

  if (appId === 'wedding-invite') {
    appEnv.ALLOW_ADMIN_BOOTSTRAP = appEnv.ALLOW_ADMIN_BOOTSTRAP || 'true'
    appEnv.E2E_ADMIN_EMAIL = appEnv.E2E_ADMIN_EMAIL || 'wedding-e2e-admin@example.com'
    appEnv.E2E_ADMIN_PASSWORD = appEnv.E2E_ADMIN_PASSWORD || 'Passw0rd!123456'
    appEnv.PAYLOAD_DB_PUSH = appEnv.PAYLOAD_DB_PUSH || 'true'
  }

  writeLog(`Created sandbox: ${sandbox.sandboxId}`)
  await runCommandWithLogs(sandbox, 'corepack-enable', 'corepack enable')
  await runCommandWithLogs(sandbox, 'corepack-prepare', 'corepack prepare pnpm@10.2.0 --activate')
  await runCommandWithLogs(
    sandbox,
    'git-clone',
    `git clone --depth 1 --branch '${escapeShell(headRef)}' 'https://x-access-token:${escapeShell(githubToken)}@github.com/${escapeShell(repo)}.git' app`
  )
  await runCommandWithLogs(
    sandbox,
    'pnpm-install',
    pnpmInstallCommand,
    {
      cwd: '/home/user/app',
      timeoutMs: 15 * 60 * 1000,
    }
  )
  if (migrationCommand) {
    await runCommandWithLogs(sandbox, 'db-migrate', migrationCommand, {
      cwd: `/home/user/app/${appPath}`,
      envs: appEnv,
      timeoutMs: 10 * 60 * 1000,
    })
  }

  if (appId === 'wedding-invite') {
    await runCommandWithLogs(sandbox, 'seed-e2e-admin', 'pnpm seed:e2e-admin', {
      cwd: `/home/user/app/${appPath}`,
      envs: appEnv,
      timeoutMs: 5 * 60 * 1000,
    })
  }

  await runCommandWithLogs(sandbox, 'pnpm-build', 'pnpm build', {
    cwd: `/home/user/app/${appPath}`,
    envs: appEnv,
    timeoutMs: 20 * 60 * 1000,
  })
  await runCommandWithLogs(
    sandbox,
    'pnpm-start-detached',
    `bash -lc 'rm -f '\''${escapedAppPidPath}'\''; nohup pnpm start > '\''${escapedAppLogPath}'\'' 2>&1 < /dev/null & echo $! > '\''${escapedAppPidPath}'\''; APP_PID=$(cat '\''${escapedAppPidPath}'\''); echo "[e2b][start] app pid=\${APP_PID} log=${appLogPath}"; sleep 1; ps -p "\${APP_PID}" -o pid=,ppid=,stat=,etime=,comm= || true'`,
    {
      cwd: `/home/user/app/${appPath}`,
      envs: appEnv,
    }
  )
  await runCommandWithLogs(
    sandbox,
    'runtime-log-forwarder',
    `bash -lc 'touch '\''${escapedAppLogPath}'\'' && tail -n +1 -F '\''${escapedAppLogPath}'\'''`,
    {
      background: true,
      cwd: `/home/user/app/${appPath}`,
      envs: appEnv,
    }
  )

  try {
    await runCommandWithLogs(
      sandbox,
      'healthcheck',
      `bash -lc 'for i in $(seq 1 60); do if curl -fsS http://127.0.0.1:${port}/ >/dev/null; then echo "[e2b][healthcheck] success attempt=\${i}"; exit 0; fi; echo "[e2b][healthcheck] retry \${i}/60"; if [ -f '\''${escapedAppLogPath}'\'' ]; then echo "[e2b][healthcheck] app log tail"; tail -n 40 '\''${escapedAppLogPath}'\''; else echo "[e2b][healthcheck] app log missing"; fi; sleep 2; done; exit 1'`,
      { timeoutMs: 2 * 60 * 1000 }
    )
  } catch (error) {
    await collectAppDiagnostics(sandbox, appLogPath, appPidPath, port)
    throw error
  }

  const result = {
    appId,
    appName,
    appPath,
    status: 'ready',
    previewUrl,
    sandboxId: sandbox.sandboxId,
    killedCount: killed,
    headSha,
  }

  setGithubOutput('preview_url', previewUrl)
  setGithubOutput('sandbox_id', sandbox.sandboxId)
  setGithubOutput('killed_count', String(killed))
  setGithubOutput('head_sha', headSha)
  setGithubOutput('result_json', JSON.stringify(result))

  writeLog(`Preview URL: ${previewUrl}`)
  writeLog(`Sandbox ID: ${sandbox.sandboxId}`)
}

async function cleanupPreview() {
  const repo = requireEnv('GITHUB_REPOSITORY')
  const prNumber = requireEnv('PR_NUMBER')
  const appId = process.env.E2B_APP_ID
  const metadata = {
    owner: 'github-actions',
    purpose: 'pr-preview',
    repo,
    pr: prNumber,
  }

  if (appId) {
    metadata.app = appId
  }

  const killed = await killSandboxes(metadata)
  writeLog(`Killed sandboxes: ${killed}`)

  setGithubOutput('killed_count', String(killed))
  setGithubOutput(
    'result_json',
    JSON.stringify({
      appId: appId || 'all',
      status: 'cleaned',
      killedCount: killed,
    })
  )
}

const mode = process.argv[2]
if (!mode || !['create', 'cleanup'].includes(mode)) {
  throw new Error("Usage: node .github/scripts/e2b-preview.mjs <create|cleanup>")
}

if (mode === 'create') {
  await createPreview()
} else {
  await cleanupPreview()
}
