'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, ShieldCheck } from 'lucide-react'
import { formatINR } from '@/lib/utils'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

/** Load Razorpay Checkout once and reuse it for the rest of the session. */
let checkoutPromise: Promise<void> | null = null
function loadCheckout(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Razorpay) return Promise.resolve()
  if (checkoutPromise) return checkoutPromise

  checkoutPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      checkoutPromise = null // allow a retry on the next click
      reject(new Error('Could not load the payment gateway.'))
    }
    if (!existing) document.body.appendChild(script)
  })
  return checkoutPromise
}

export default function PayNow({
  entityType,
  entityId,
  amount,
  onPaid,
}: {
  entityType: 'registration' | 'business'
  entityId: string
  amount: number // whole rupees, for display only — the server decides the real amount
  onPaid?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [paid, setPaid] = useState(false)

  // Warm the script up while the user is reading the confirmation.
  useEffect(() => {
    loadCheckout().catch(() => {})
  }, [])

  const handlePay = useCallback(async () => {
    setBusy(true)
    try {
      await loadCheckout()

      const orderRes = await fetch('/api/payment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
      })
      const order = await orderRes.json()

      if (!orderRes.ok) {
        if (order.code === 'ALREADY_PAID') {
          setPaid(true)
          toast.success('This payment is already complete.')
        } else {
          toast.error(order.error || 'Could not start the payment.')
        }
        setBusy(false)
        return
      }

      const rzp = new window.Razorpay!({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        notes: { entity_type: entityType, entity_id: entityId },
        theme: { color: '#C9A227' },
        modal: {
          ondismiss: () => setBusy(false),
        },
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            const result = await verifyRes.json()
            if (!verifyRes.ok) {
              toast.error(result.error || 'Payment could not be confirmed.')
              setBusy(false)
              return
            }
            setPaid(true)
            setBusy(false)
            toast.success('Payment received. Thank you!')
            onPaid?.()
          } catch {
            toast.error('Payment went through but confirmation failed. Our team will verify it.')
            setBusy(false)
          }
        },
      })

      rzp.open()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment could not be started.')
      setBusy(false)
    }
  }, [entityType, entityId, onPaid])

  if (paid) {
    return (
      <div className="border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
        <p className="font-cinzel text-emerald-300 text-lg">Payment Received</p>
        <p className="font-cormorant text-[16px] text-cream/65 mt-1">
          {formatINR(amount)} paid successfully. Your submission is confirmed.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-gold/25 bg-gold/[0.04] p-6 text-center">
      <p className="eyebrow mb-2">Amount Due</p>
      <p className="font-cinzel text-3xl text-gold-gradient mb-5">{formatINR(amount)}</p>

      <button type="button" onClick={handlePay} disabled={busy} className="btn-gold w-full">
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Opening secure checkout…
          </>
        ) : (
          `Pay ${formatINR(amount)} Securely`
        )}
      </button>

      <p className="font-montserrat text-[10px] tracking-[0.12em] text-cream/40 mt-4 flex items-center justify-center gap-2">
        <ShieldCheck size={13} className="text-gold/70" />
        UPI · Cards · Net Banking · Wallets — secured by Razorpay
      </p>
    </div>
  )
}
