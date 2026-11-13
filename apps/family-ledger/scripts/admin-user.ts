import bcrypt from 'bcryptjs'
import pg from 'pg'

interface Arguments {
  username?: string
  role?: 'admin' | 'viewer'
}

function parseArguments(argv: string[]): Arguments {
  const result: Arguments = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--') continue
    if (value === '--username') result.username = argv[++index]
    else if (value === '--role') {
      const role = argv[++index]
      if (role !== 'admin' && role !== 'viewer') throw new Error('--role must be admin or viewer')
      result.role = role
    } else throw new Error(`unknown argument: ${value}`)
  }
  return result
}

async function readPassword(): Promise<string> {
  if (process.stdin.isTTY) throw new Error('password must be piped on stdin; never pass it as a command-line argument')
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.replace(/\r?\n$/, '')
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const username = args.username?.trim().toLowerCase()
  const role = args.role ?? 'viewer'
  if (!username || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    throw new Error('usage: pnpm --filter family-ledger admin:user -- --username NAME --role ROLE < password-file')
  }
  const password = await readPassword()
  const passwordBytes = Buffer.byteLength(password, 'utf8')
  if (password.length < 12 || passwordBytes > 72) {
    throw new Error('password must be at least 12 characters and at most 72 UTF-8 bytes')
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const passwordHash = await bcrypt.hash(password, 12)
    await pool.query(
      `INSERT INTO family_ledger.users (username, password_hash, role, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         active = true,
         updated_at = now()`,
      [username, passwordHash, role],
    )
    console.log(`saved ${role} user ${username}`)
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'user administration failed')
  process.exitCode = 1
})
