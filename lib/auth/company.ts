import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// Salted scrypt hash of a company admin password, stored as "salt:derived".
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${derived}`
}

export function verifyAdminPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const [salt, derived] = stored.split(':')
  if (!salt || !derived) return false
  const test = scryptSync(password, salt, 32)
  const expected = Buffer.from(derived, 'hex')
  return expected.length === test.length && timingSafeEqual(expected, test)
}

// Shareable, human-typable code employees use to join their company.
export function generateCompanyCode(): string {
  return randomBytes(4).toString('hex').toUpperCase() // 8 hex chars, e.g. 9F3A7C21
}
