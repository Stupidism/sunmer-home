import fs from 'node:fs'
import { Client } from 'pg'

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const env = {}

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) {
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }
    const key = line.slice(0, separatorIndex)
    const value = line.slice(separatorIndex + 1)
    env[key] = value
  }

  return env
}

function parseDishNames(source, constName) {
  const startToken = `export const ${constName} = [`
  const startIndex = source.indexOf(startToken)
  if (startIndex === -1) {
    throw new Error(`Cannot locate ${constName}`)
  }

  const tail = source.slice(startIndex + startToken.length)
  const endIndex = tail.indexOf('] as const')
  if (endIndex === -1) {
    throw new Error(`Cannot parse dish list for ${constName}`)
  }

  const section = tail.slice(0, endIndex)
  return Array.from(section.matchAll(/'([^']+)'/g)).map((match) => match[1])
}

async function seed() {
  const env = readEnvFile('.env.local')
  const connectionString = env.PAYLOAD_DATABASE_URL || env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Missing PAYLOAD_DATABASE_URL or DATABASE_URL in .env.local')
  }

  const source = fs.readFileSync('src/lib/weekly-menu/dishes.ts', 'utf8')
  const records = [
    ...parseDishNames(source, 'BIG_MEAT_DISH_NAMES').map((name) => ({
      name,
      category: 'big-meat',
    })),
    ...parseDishNames(source, 'SMALL_MEAT_DISH_NAMES').map((name) => ({
      name,
      category: 'small-meat',
    })),
    ...parseDishNames(source, 'VEGETABLE_DISH_NAMES').map((name) => ({
      name,
      category: 'vegetable',
    })),
  ]

  const client = new Client({ connectionString })
  await client.connect()

  const existingRows = await client.query('SELECT name FROM planner_recipes')
  const existingNames = new Set(existingRows.rows.map((row) => row.name))

  let inserted = 0
  for (const record of records) {
    if (existingNames.has(record.name)) {
      continue
    }

    await client.query('INSERT INTO planner_recipes (name, category) VALUES ($1, $2)', [
      record.name,
      record.category,
    ])
    inserted += 1
  }

  const totals = await client.query(
    "SELECT category::text AS category, COUNT(*)::int AS count FROM planner_recipes GROUP BY category ORDER BY category"
  )

  await client.end()

  console.log(`Inserted recipes: ${inserted}`)
  for (const row of totals.rows) {
    console.log(`${row.category}: ${row.count}`)
  }
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
