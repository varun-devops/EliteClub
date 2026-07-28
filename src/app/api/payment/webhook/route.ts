import { NextResponse } from 'next/server'
import { isWebhookConfigured, verifyWebhookSignature } from '@/lib/payments/razorpay'
import { markFailed, markPaid } from '@/lib/payments/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/payment/webhook
 *
 * Razorpay → us, server to server. This is the authoritative source of truth:
 * it fires even when the customer closes the tab mid-payment, so money never
 * lands in the bank account without the submission being marked paid.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL     https://<your-domain>/api/payment/webhook
 *   Events  payment.captured, payment.failed
 *   Secret  = RAZORPAY_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  // The signature is computed over the RAW body — read it as text, never
  // re-serialise the parsed JSON or the HMAC will not match.
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  if (!isWebhookConfigured()) {
    console.error('[payment/webhook] RAZORPAY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 })
  }

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    console.error('[payment/webhook] invalid signature — ignoring')
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const type: string = event?.event ?? ''
  const payment = event?.payload?.payment?.entity

  try {
    if (type === 'payment.captured' && payment?.order_id) {
      await markPaid({
        orderId: payment.order_id,
        paymentId: payment.id,
        method: payment.method,
        amountInPaise: payment.amount,
      })
    } else if (type === 'payment.failed' && payment?.order_id) {
      await markFailed({
        orderId: payment.order_id,
        paymentId: payment.id,
        reason: payment.error_description ?? 'Payment failed',
      })
    }
  } catch (e) {
    // Returning 500 makes Razorpay retry, which is what we want on a DB blip.
    console.error('[payment/webhook] handler error:', e)
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }

  // Always 200 for events we do not handle, so Razorpay stops retrying them.
  return NextResponse.json({ ok: true })
}
