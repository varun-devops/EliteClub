import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/admin'
import {
  fetchPayment,
  isRazorpayConfigured,
  verifyCheckoutSignature,
} from '@/lib/payments/razorpay'
import { markPaid } from '@/lib/payments/orders'

export const runtime = 'nodejs'

/**
 * POST /api/payment/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Called by the browser right after Razorpay Checkout succeeds, so the user
 * gets instant confirmation. The webhook is the safety net for the cases the
 * browser never reaches us (tab closed, network drop) — both are idempotent.
 */
export async function POST(req: Request) {
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const orderId = String(body.razorpay_order_id ?? '')
  const paymentId = String(body.razorpay_payment_id ?? '')
  const signature = String(body.razorpay_signature ?? '')

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: 'Incomplete payment details.' }, { status: 400 })
  }

  if (!isRazorpayConfigured() || !isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })
  }

  // The signature proves the payload really came from Razorpay and was not
  // forged by the browser. Without this check anyone could mark themselves paid.
  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    console.error('[payment/verify] signature mismatch for order', orderId)
    return NextResponse.json(
      { error: 'Payment could not be verified. If money was debited, contact support.' },
      { status: 400 }
    )
  }

  try {
    // Ask Razorpay directly what actually happened — the browser only tells us
    // what it was handed.
    const payment = await fetchPayment(paymentId)
    if (payment.order_id !== orderId) {
      return NextResponse.json({ error: 'Payment/order mismatch.' }, { status: 400 })
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return NextResponse.json(
        { error: 'Payment has not completed yet. Please try again.' },
        { status: 400 }
      )
    }

    const result = await markPaid({
      orderId,
      paymentId,
      signature,
      method: payment.method,
      amountInPaise: payment.amount,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Payment recorded by the gateway but not matched here. Our team will confirm.' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      ok: true,
      payment_id: paymentId,
      message: 'Payment received. Your submission is confirmed.',
    })
  } catch (e) {
    console.error('[payment/verify] failed:', e)
    return NextResponse.json(
      { error: 'Could not confirm the payment. Our team will verify it shortly.' },
      { status: 500 }
    )
  }
}
