import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'ENCRYPTION_SECRET environment variable is not set or is too short. ' +
      'Set a random 32+ character string in your environment variables.'
    )
  }
  return crypto.createHash('sha256').update(String(secret)).digest()
}

export function encrypt(text: string): string {
  if (!text) return text

  const iv  = crypto.randomBytes(16)
  const key = getKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag().toString('hex')

  return Buffer.from(`${iv.toString('hex')}:${authTag}:${encrypted}`).toString('base64')
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText

  const text  = Buffer.from(encryptedText, 'base64').toString('ascii')
  const parts = text.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted text format')

  const [ivHex, authTagHex, encryptedHex] = parts
  const iv      = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key     = getKey()

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
