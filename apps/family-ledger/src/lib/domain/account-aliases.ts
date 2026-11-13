import type { Json } from './types'

export interface AccountRule {
  id: string
  label: string
  aliases: readonly string[]
}

export interface AccountAliasDocument {
  accounts: readonly AccountRule[]
}

export interface AccountResolver {
  key(account: string, owner?: string): string
  label(account: string, owner?: string): string
}

const walletBases: Record<string, string> = {
  零钱: '零钱',
  余额宝: '余额宝',
  账户余额: '账户余额',
}

const walletOwnerPrefixes = new Set([
  '本人-零钱',
  '配偶-零钱',
  '本人-余额宝',
  '配偶-余额宝',
  '本人-账户余额',
  '配偶-账户余额',
])

function normalizedOwner(owner?: string): string {
  const value = owner?.trim() || '未注明归属'
  if (value === '本人（附属卡关系待核实）') return '本人'
  if (value === '待核实' || value === '未注明归属' || value === '家庭') return '未核实'
  return value
}

export function ownerKey(owner?: string): string {
  return normalizedOwner(owner)
}

function objectRecord(value: Json | undefined): Record<string, Json> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function text(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseAccountAliases(input: Json): AccountAliasDocument {
  const root = objectRecord(input)
  if (!root || !Array.isArray(root.accounts)) {
    throw new Error('account aliases must be an object containing an accounts array')
  }

  const accounts: AccountRule[] = []
  const seenIds = new Set<string>()
  const seenAliases = new Set<string>()

  for (const [index, rawAccount] of root.accounts.entries()) {
    const account = objectRecord(rawAccount)
    if (!account) throw new Error(`account aliases accounts[${index}] must be an object`)
    const id = text(account.id)
    const label = text(account.label)
    if (!id || !/^[A-Z0-9][A-Z0-9_-]*$/.test(id)) {
      throw new Error(`account aliases accounts[${index}].id is invalid`)
    }
    if (!label) throw new Error(`account aliases accounts[${index}].label is invalid`)
    if (!Array.isArray(account.aliases)) {
      throw new Error(`account aliases accounts[${index}].aliases must be an array`)
    }
    const aliases = account.aliases.map((value, aliasIndex) => {
      const alias = text(value)
      if (!alias) throw new Error(`account aliases accounts[${index}].aliases[${aliasIndex}] is invalid`)
      if (seenAliases.has(alias)) throw new Error(`duplicate account alias: ${alias}`)
      seenAliases.add(alias)
      return alias
    })
    if (!aliases.length) throw new Error(`account ${id} needs at least one alias`)
    if (seenIds.has(id)) throw new Error(`duplicate account id: ${id}`)
    seenIds.add(id)
    accounts.push({ id, label, aliases })
  }

  return { accounts }
}

export function createAccountResolver(document: AccountAliasDocument = { accounts: [] }): AccountResolver {
  const rules = new Map<string, AccountRule>()
  for (const account of document.accounts) {
    for (const alias of account.aliases) rules.set(alias, account)
  }

  function ruleFor(account: string): AccountRule | null {
    const value = account.trim()
    if (!value) return null
    const direct = rules.get(value)
    if (direct) return direct
    const suffix = value.indexOf('&')
    if (suffix > 0) {
      const base = value.slice(0, suffix).trim()
      const byBase = rules.get(base)
      if (byBase) return byBase
    }
    return null
  }

  function walletKey(account: string, owner?: string): string | null {
    const value = account.trim()
    const base = value.replace(/^(本人|配偶)-/, '')
    if (!walletBases[base]) return null
    const ownerPart = walletOwnerPrefixes.has(value)
      ? normalizedOwner(value.split('-', 1)[0])
      : normalizedOwner(owner)
    return `WALLET-${ownerPart}-${walletBases[base]}`
  }

  return {
    key(account, owner) {
      const rule = ruleFor(account)
      if (rule) return rule.id
      return walletKey(account, owner) ?? account.trim()
    },
    label(account, owner) {
      const rule = ruleFor(account)
      if (rule) return rule.label
      return this.key(account, owner)
    },
  }
}
