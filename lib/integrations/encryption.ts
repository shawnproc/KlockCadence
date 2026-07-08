import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto'

// INTEGRATION_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
// Generate with: openssl rand -hex 32
function getKey(): Buffer {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 64-char hex string')
  }
  return Buffer.from(hex, 'hex')
}

// AES-256-GCM encryption. Returns "iv_hex:ciphertext_hex:authtag_hex".
export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${ct.toString('hex')}:${tag.toString('hex')}`
}

// Decrypt a value produced by encryptToken.
export function decryptToken(encrypted: string): string {
  const [ivHex, ctHex, tagHex] = encrypted.split(':')
  if (!ivHex || !ctHex || !tagHex) throw new Error('Invalid encrypted token format')
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const ct = Buffer.from(ctHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

// HMAC-SHA256 used for OAuth state signing.
export function hmacSign(payload: string): string {
  return createHmac('sha256', getKey()).update(payload).digest('hex').slice(0, 24)
}
