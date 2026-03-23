/**
 * Given a date, return the Monday of that ISO week as YYYY-MM-DD.
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return formatDate(d)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseWeekStart(weekStr: string): Date {
  const d = new Date(weekStr + 'T00:00:00Z')
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${weekStr}`)
  return d
}

export function getPrevWeekStart(weekStart: string): string {
  const d = parseWeekStart(weekStart)
  d.setDate(d.getDate() - 7)
  return formatDate(d)
}

/** Returns YYYY-MM-DD of the day after the given date string. */
export function getNextDay(dateStr: string): string {
  const d = parseWeekStart(dateStr)
  d.setDate(d.getDate() + 1)
  return formatDate(d)
}
