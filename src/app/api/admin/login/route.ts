import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE,
  adminEmail,
  checkAdminCredentials,
  createSessionToken,
  SESSION_MAX_AGE,
} from '@/lib/admin-auth'

export const runtime = 'nodejs'

// ── Brute-force protection ───────────────────────────────────────────
// The admin panel exposes applicants' government IDs and phone numbers, so a
// guessable password must not be freely guessable at speed. Five tries per IP
// per 15 minutes turns an instant attack into an impractical one.
//
// In-memory: it resets when the app restarts and is per-process. That is fine
// for a single PM2 instance; move it to the database if you ever run several.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

const attempts = new Map<string, { count: number; firstAt: number }>()

function clientIp(req: Request): string {
  // Behind Nginx, the real client IP arrives in X-Forwarded-For.
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function rateLimit(ip: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now })
    return { blocked: false, retryAfter: 0 }
  }

  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) {
    return {
      blocked: true,
      retryAfter: Math.ceil((entry.firstAt + WINDOW_MS - now) / 1000),
    }
  }
  return { blocked: false, retryAfter: 0 }
}

// Keep the map from growing forever on a long-running server.
function sweep() {
  const now = Date.now()
  for (const [ip, entry] of attempts) {
    if (now - entry.firstAt > WINDOW_MS) attempts.delete(ip)
  }
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!process.env.ADMIN_PASSWORD || !adminEmail()) {
    return NextResponse.json(
      {
        error:
          'Admin login is not set up. Add ADMIN_EMAIL and ADMIN_PASSWORD to .env.local.',
      },
      { status: 503 }
    )
  }

  sweep()
  const ip = clientIp(req)
  const limit = rateLimit(ip)
  if (limit.blocked) {
    const mins = Math.ceil(limit.retryAfter / 60)
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password || !checkAdminCredentials(email, password)) {
    // One message for both cases — never reveal which half was wrong.
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
  }

  // Successful login clears that IP's strike count.
  attempts.delete(ip)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, createSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
