import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/admin'
import {
  createOrder,
  isRazorpayConfigured,
  razorpayKeyId,
} from '@/lib/payments/razorpay'
import {
  ENTITY_CONFIG,
  findReusableOrder,
  isEntityType,
  loadPayableEntity,
  recordOrder,
} from '@/lib/payments/orders'
import { BRAND } from '@/lib/constants'

export const runtime = 'nodejs'

/**
 * POST /api/payment/order
 * Body: { entity_type: 'registration' | 'business', entity_id: uuid }
 *
 * Creates (or re-uses) a Razorpay order for an already-saved submission.
 * The amount comes from the database, never from the browser.
 */
export async function POST(req: Request) {
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const entityType = body.entity_type
  const entityId = typeof body.entity_id === 'string' ? body.entity_id.trim() : ''

  if (!isEntityType(entityType) || !entityId) {
    return NextResponse.json({ error: 'Invalid payment request.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Database is not configured yet.', code: 'NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      {
        error:
          'Online payment is not enabled yet. Our team will contact you with payment details.',
        code: 'GATEWAY_NOT_CONFIGURED',
      },
      { status: 503 }
    )
  }

  try {
    const entity = await loadPayableEntity(entityType, entityId)
    if (!entity) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
    }

    if (entity.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'This payment has already been completed.', code: 'ALREADY_PAID' },
        { status: 409 }
      )
    }
    if (entity.fee_amount <= 0) {
      return NextResponse.json(
        { error: 'No payment is due for this submission.', code: 'NO_FEE' },
        { status: 400 }
      )
    }

    const amountInPaise = Math.round(entity.fee_amount * 100)

    // Re-open an existing unpaid order instead of stacking up new ones when
    // the customer reloads the page or closes the checkout and comes back.
    const existing = await findReusableOrder(entityType, entityId, amountInPaise)
    const orderId =
      existing?.order_id ??
      (
        await createOrder({
          amountInRupees: entity.fee_amount,
          receipt: `${entityType.slice(0, 3)}_${entityId.replace(/-/g, '').slice(0, 24)}`,
          notes: {
            entity_type: entityType,
            entity_id: entityId,
            name: entity.name,
          },
        })
      ).id

    if (!existing) {
      await recordOrder({
        entityType,
        entityId,
        orderId,
        amountInPaise,
        email: entity.email,
        contact: entity.mobile,
      })
    }

    return NextResponse.json({
      ok: true,
      key_id: razorpayKeyId(),
      order_id: orderId,
      amount: amountInPaise,
      currency: 'INR',
      name: BRAND.name,
      description: ENTITY_CONFIG[entityType].label,
      prefill: {
        name: entity.name,
        email: entity.email,
        contact: entity.mobile,
      },
    })
  } catch (e) {
    console.error('[payment/order] failed:', e)
    return NextResponse.json(
      { error: 'Could not start the payment. Please try again.' },
      { status: 500 }
    )
  }
}
