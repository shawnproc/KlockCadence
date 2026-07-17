import { randomBytes } from 'crypto'

// Shareable, human-typable code employees use to join their company.
export function generateCompanyCode(): string {
  return randomBytes(4).toString('hex').toUpperCase() // 8 hex chars, e.g. 9F3A7C21
}
