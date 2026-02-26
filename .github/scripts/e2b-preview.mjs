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

async function createPreview() {
  const repo = requireEnv('GITHUB_REPOSITORY')
  const prNumber = requireEnv('PR_NUMBER')
  const headRef = requireEnv('PR_HEAD_REF')
  const headSha = requireEnv('PR_HEAD_SHA')
  const githubToken = requireEnv('GH_TOKEN')

  const appPath = process.env.E2B_APP_PATH || 'apps/bubu-log'
  const port = parseOptionalInt(process.env.E2B_APP_PORT, 1030)
  const timeoutMs = parseOptionalInt(process.env.E2B_TIMEOUT_MS, 60 * 60 * 1000)
  const template = process.env.E2B_TEMPLATE

  const metadata = {
    owner: 'github-actions',
    purpose: 'pr-preview',
    repo,
    pr: prNumber,
  }

  const killed = await killSandboxes(metadata)
  console.log(`Killed existing sandboxes: ${killed}`)

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

  await sandbox.commands.run('corepack enable')
  await sandbox.commands.run('corepack prepare pnpm@10.2.0 --activate')
  await sandbox.commands.run(
    `git clone --depth 1 --branch '${escapeShell(headRef)}' 'https://x-access-token:${escapeShell(githubToken)}@github.com/${escapeShell(repo)}.git' app`
  )
  await sandbox.commands.run(
    'pnpm install --frozen-lockfile --filter bubu-log... --child-concurrency=1 --workspace-concurrency=1 --network-concurrency=4',
    {
    cwd: '/home/user/app',
    timeoutMs: 15 * 60 * 1000,
    }
  )
  await sandbox.commands.run('pnpm build', {
    cwd: `/home/user/app/${appPath}`,
    envs: appEnv,
    timeoutMs: 20 * 60 * 1000,
  })
  await sandbox.commands.run('pnpm start', {
    cwd: `/home/user/app/${appPath}`,
    envs: appEnv,
    background: true,
  })
  await sandbox.commands.run(
    `bash -lc 'for i in $(seq 1 60); do curl -fsS http://127.0.0.1:${port}/ >/dev/null && exit 0; sleep 2; done; exit 1'`,
    { timeoutMs: 2 * 60 * 1000 }
  )

  const output = process.env.GITHUB_OUTPUT
  if (output) {
    const lines = [
      `preview_url=${previewUrl}`,
      `sandbox_id=${sandbox.sandboxId}`,
      `killed_count=${killed}`,
      `head_sha=${headSha}`,
    ]
    appendFileSync(output, lines.join('\n') + '\n')
  }

  console.log(`Preview URL: ${previewUrl}`)
  console.log(`Sandbox ID: ${sandbox.sandboxId}`)
}

async function cleanupPreview() {
  const repo = requireEnv('GITHUB_REPOSITORY')
  const prNumber = requireEnv('PR_NUMBER')
  const metadata = {
    owner: 'github-actions',
    purpose: 'pr-preview',
    repo,
    pr: prNumber,
  }

  const killed = await killSandboxes(metadata)
  console.log(`Killed sandboxes: ${killed}`)

  const output = process.env.GITHUB_OUTPUT
  if (output) {
    appendFileSync(output, `killed_count=${killed}\n`)
  }
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
