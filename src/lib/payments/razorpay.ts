// ════════════════════════════════════════════════════════════════════
//  RAZORPAY — server-side helpers (SERVER ONLY)
//
//  We talk to Razorpay's REST API directly with fetch + Basic auth, so
//  there is no extra npm dependency to install or keep updated.
//
//  Env vars (see .env.example):
//    NEXT_PUBLIC_RAZORPAY_KEY_ID   — public, safe in the browser
//    RAZORPAY_KEY_SECRET           — SECRET, server only
//    RAZORPAY_WEBHOOK_SECRET       — SECRET, server only
// ════════════════════════════════════════════════════════════════════

import crypto from 'crypto'

const API_BASE = 'https://api.razorpay.com/v1'

/** Public key id — safe to send to the browser (checkout needs it). */
export function razorpayKeyId(): string {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ''
}

function razorpayKeySecret(): string {
  return process.env.RAZORPAY_KEY_SECRET ?? ''
}

function razorpayWebhookSecret(): string {
  return process.env.RAZORPAY_WEBHOOK_SECRET ?? ''
}

/** True only when the Razorpay keys look real (not the .env.example placeholders). */
export function isRazorpayConfigured(): boolean {
  const id = razorpayKeyId()
  const secret = razorpayKeySecret()
  return (
    /^rzp_(test|live)_\w+/.test(id) &&
    secret.length > 10 &&
    !secret.includes('YOUR_')
  )
}

/** True when we are pointed at a LIVE (real money) Razorpay account. */
export function isRazorpayLive(): boolean {
  return razorpayKeyId().startsWith('rzp_live_')
}

function authHeader(): string {
  const token = Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString('base64')
  return `Basic ${token}`
}

// ── Types ────────────────────────────────────────────────────────────

export type RazorpayOrder = {
  id: string
  amount: number // paise
  currency: string
  receipt: string | null
  status: 'created' | 'attempted' | 'paid'
  notes?: Record<string, string>
}

export type RazorpayPayment = {
  id: string
  order_id: string | null
  amount: number // paise
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  method?: string
  email?: string
  contact?: string
  error_description?: string | null
  notes?: Record<string, string>
}

// ── API calls ────────────────────────────────────────────────────────

async function razorpayFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON response — handled below */
  }

  if (!res.ok) {
    const reason = json?.error?.description ?? text ?? `HTTP ${res.status}`
    throw new Error(`Razorpay ${path} failed: ${reason}`)
  }
  return json as T
}

/**
 * Create a Razorpay order.
 * @param amountInRupees whole rupees — converted to paise here, in one place.
 */
export async function createOrder(opts: {
  amountInRupees: number
  receipt: string
  notes?: Record<string, string>
}): Promise<RazorpayOrder> {
  return razorpayFetch<RazorpayOrder>('/orders', {
    method: 'POST',
    body: {
      amount: Math.round(opts.amountInRupees * 100), // paise
      currency: 'INR',
      // Razorpay caps receipt at 40 chars.
      receipt: opts.receipt.slice(0, 40),
      notes: opts.notes ?? {},
      payment_capture: 1, // auto-capture — money settles without a manual step
    },
  })
}

/** Fetch a payment straight from Razorpay (authoritative amount/status check). */
export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`)
}

// ── Signature verification ───────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verify the signature Razorpay Checkout hands back to the browser.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyCheckoutSignature(opts: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const secret = razorpayKeySecret()
  if (!secret) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest('hex')
  return safeEqual(expected, opts.signature)
}

/**
 * Verify a webhook call.
 * signature = HMAC_SHA256(raw request body, webhook_secret)
 * The RAW body string must be used — re-serialising parsed JSON breaks it.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = razorpayWebhookSecret()
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return safeEqual(expected, signature)
}

export function isWebhookConfigured(): boolean {
  const s = razorpayWebhookSecret()
  return s.length > 10 && !s.includes('YOUR_')
}
