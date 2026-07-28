import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import PayNow from '@/components/payments/PayNow'

export type PendingPayment = {
  entityType: 'registration' | 'business'
  entityId: string
  amount: number
}

export default function SuccessCard({
  title,
  message,
  payment,
}: {
  title: string
  message: string
  /** When set, a "Pay now" block is shown before the navigation links. */
  payment?: PendingPayment | null
}) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 size={40} className="text-emerald-400" />
      </div>
      <h2 className="font-cinzel text-3xl text-gold-light mb-4">{title}</h2>
      <p className="font-cormorant text-[18px] text-cream/70 max-w-md mx-auto mb-9 leading-relaxed">
        {message}
      </p>

      {payment && (
        <div className="max-w-md mx-auto mb-9 text-left">
          <PayNow
            entityType={payment.entityType}
            entityId={payment.entityId}
            amount={payment.amount}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/" className="btn-gold">Back to Home</Link>
        <Link href="/register" className="btn-ghost">Register Another</Link>
      </div>
    </div>
  )
}
