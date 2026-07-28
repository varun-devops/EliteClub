// ════════════════════════════════════════════════════════════════════
//  PAYMENTS — the bridge between Razorpay and our own tables.
//
//  One `payments` row per Razorpay order. It is the audit trail: what was
//  charged, for which registration / business post, and what happened.
//  Both the browser callback (/api/payment/verify) and the Razorpay
//  webhook (/api/payment/webhook) funnel into `markPaid` below, so a
//  payment settles correctly even if the customer closes the tab.
// ════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'

export type EntityType = 'registration' | 'business'

/** Which table + columns each payable entity lives in. */
export const ENTITY_CONFIG = {
  registration: {
    table: 'registrations',
    nameColumn: 'full_name',
    label: 'Elite Club Registration',
  },
  business: {
    table: 'business_posts',
    nameColumn: 'contact_name',
    label: 'Requirement Posting',
  },
} as const

export function isEntityType(v: unknown): v is EntityType {
  return v === 'registration' || v === 'business'
}

export type PayableEntity = {
  id: string
  name: string
  email: string
  mobile: string
  fee_amount: number
  payment_status: string
}

/**
 * Load a payable row. Returns null when the id does not exist.
 * The fee is read from the DB — never trusted from the browser.
 */
export async function loadPayableEntity(
  entityType: EntityType,
  entityId: string
): Promise<PayableEntity | null> {
  const cfg = ENTITY_CONFIG[entityType]
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from(cfg.table)
    .select(`id, ${cfg.nameColumn}, email, mobile, fee_amount, payment_status`)
    .eq('id', entityId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as Record<string, any>
  return {
    id: row.id,
    name: row[cfg.nameColumn] ?? '',
    email: row.email ?? '',
    mobile: row.mobile ?? '',
    fee_amount: Number(row.fee_amount ?? 0),
    payment_status: row.payment_status ?? 'pending',
  }
}

export type PaymentRow = {
  id: string
  entity_type: EntityType
  entity_id: string
  order_id: string
  payment_id: string | null
  amount: number // paise
  status: 'created' | 'attempted' | 'paid' | 'failed' | 'refunded'
}

/** Find an unpaid order we already created for this entity at this amount. */
export async function findReusableOrder(
  entityType: EntityType,
  entityId: string,
  amountInPaise: number
): Promise<PaymentRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('id, entity_type, entity_id, order_id, payment_id, amount, status')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('amount', amountInPaise)
    .in('status', ['created', 'attempted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as PaymentRow | null) ?? null
}

export async function recordOrder(opts: {
  entityType: EntityType
  entityId: string
  orderId: string
  amountInPaise: number
  email: string
  contact: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('payments').insert({
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    order_id: opts.orderId,
    amount: opts.amountInPaise,
    currency: 'INR',
    status: 'created',
    email: opts.email,
    contact: opts.contact,
  })
  if (error) throw new Error(`Could not record payment order: ${error.message}`)
}

export async function findPaymentByOrderId(orderId: string): Promise<PaymentRow | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('payments')
    .select('id, entity_type, entity_id, order_id, payment_id, amount, status')
    .eq('order_id', orderId)
    .maybeSingle()
  return (data as PaymentRow | null) ?? null
}

/**
 * Settle a successful payment: flip the `payments` row to paid AND flip the
 * owning registration / business post to payment_status = 'paid'.
 *
 * Idempotent — calling it twice (browser callback + webhook, which is the
 * normal case) is harmless.
 */
export async function markPaid(opts: {
  orderId: string
  paymentId: string
  signature?: string
  method?: string
  amountInPaise?: number
}): Promise<{ ok: boolean; entityType?: EntityType; entityId?: string }> {
  const supabase = createAdminClient()

  const payment = await findPaymentByOrderId(opts.orderId)
  if (!payment) return { ok: false }

  // Amount guard: never settle an order for less than we asked for.
  if (opts.amountInPaise != null && opts.amountInPaise < payment.amount) {
    console.error(
      `[payments] amount mismatch on ${opts.orderId}: expected ${payment.amount}, got ${opts.amountInPaise}`
    )
    return { ok: false }
  }

  await supabase
    .from('payments')
    .update({
      payment_id: opts.paymentId,
      signature: opts.signature ?? null,
      method: opts.method ?? null,
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('order_id', opts.orderId)

  const cfg = ENTITY_CONFIG[payment.entity_type]
  await supabase
    .from(cfg.table)
    .update({ payment_status: 'paid' })
    .eq('id', payment.entity_id)

  return { ok: true, entityType: payment.entity_type, entityId: payment.entity_id }
}

/** Record a failed attempt. Leaves the entity as 'pending' so it can be retried. */
export async function markFailed(opts: {
  orderId: string
  paymentId?: string
  reason?: string
}): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('payments')
    .update({
      payment_id: opts.paymentId ?? null,
      status: 'failed',
      error_description: opts.reason ?? null,
    })
    .eq('order_id', opts.orderId)
    // Never downgrade a payment that already settled.
    .neq('status', 'paid')
}
