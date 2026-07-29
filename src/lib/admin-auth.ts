import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Lightweight admin session token, signed with ADMIN_SESSION_SECRET.
 * Format: base64url(payloadJSON).hexHmac
 * No external deps; verified in middleware (Node runtime) and routes.
 */

export const ADMIN_COOKIE = 'elite_admin'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 hours

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'insecure-dev-secret-change-me'
}

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

export function createSessionToken(email?: string): string {
  const payload = JSON.stringify({
    role: 'admin',
    email: email ?? adminEmail(),
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  })
  const body = b64url(payload)
  const sig = createHmac('sha256', secret()).update(body).digest('hex')
  return `${body}.${sig}`
}

/** Read the signed-in admin's email out of a session cookie (display only). */
export function sessionEmail(token: string | undefined | null): string | null {
  if (!verifySessionToken(token)) return null
  try {
    const body = token!.split('.')[0]
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !token.includes('.')) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false

  const expected = createHmac('sha256', secret()).update(body).digest('hex')
  // constant-time compare
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.role !== 'admin') return false
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return false
    return true
  } catch {
    return false
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS

/** The email allowed to sign in to /admin. */
export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
}

/**
 * Constant-time string compare that does not leak length.
 * Hashing both sides first makes every comparison the same 32 bytes, so an
 * attacker cannot learn the password length from response timing.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHmac('sha256', secret()).update(a).digest()
  const hb = createHmac('sha256', secret()).update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** Check an email + password pair against ADMIN_EMAIL / ADMIN_PASSWORD. */
export function checkAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = adminEmail()
  const expectedPassword = process.env.ADMIN_PASSWORD || ''
  if (!expectedEmail || !expectedPassword) return false

  // Always evaluate both so a wrong email and a wrong password take the same
  // time — otherwise the response reveals which half was correct.
  const emailOk = constantTimeEquals(email.trim().toLowerCase(), expectedEmail)
  const passwordOk = constantTimeEquals(password, expectedPassword)
  return emailOk && passwordOk
}

/** @deprecated password-only login — kept so older links keep working. */
export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || ''
  if (!expected) return false
  return constantTimeEquals(input, expected)
}
