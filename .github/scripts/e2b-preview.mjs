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
    const page = await paginator.nextItems()
    all.push(...page)
  }

  return all
}

async function killSandboxes(metadata) {
  const sandboxes = await listSandboxesByMetadata(metadata)
  for (const sandbox of sandboxes) {
    await Sandbox.kill(sandbox.sandboxId)
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
    ? await Sandbox.create(template, { timeoutMs, metadata })
    : await Sandbox.create({ timeoutMs, metadata })

  const previewUrl = `https://${sandbox.getHost(port)}`
  const appEnv = {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    PORT: String(port),
    NEXTAUTH_URL: previewUrl,
    AUTH_TRUST_HOST: 'true',
    ...loadPreviewEnvFromBase64(),
  }

  if (appId === 'wedding-invite') {
    appEnv.ALLOW_ADMIN_BOOTSTRAP = appEnv.ALLOW_ADMIN_BOOTSTRAP || 'true'
    appEnv.E2E_ADMIN_EMAIL = appEnv.E2E_ADMIN_EMAIL || 'wedding-e2e-admin@example.com'
    appEnv.E2E_ADMIN_PASSWORD = appEnv.E2E_ADMIN_PASSWORD || 'Passw0rd!123456'
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
  await runCommandWithLogs(sandbox, 'pnpm-start', 'pnpm start', {
    cwd: `/home/user/app/${appPath}`,
    envs: appEnv,
    background: true,
  })
  await runCommandWithLogs(
    sandbox,
    'healthcheck',
    `bash -lc 'for i in $(seq 1 60); do curl -fsS http://127.0.0.1:${port}/ >/dev/null && exit 0; sleep 2; done; exit 1'`,
    { timeoutMs: 2 * 60 * 1000 }
  )

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
