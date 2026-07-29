import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin'
import AdminHeader from '@/components/admin/AdminHeader'
import NotConfigured from '@/components/admin/NotConfigured'
import StatCard from '@/components/admin/StatCard'
import { formatDate, formatINR } from '@/lib/utils'
import { IndianRupee, CheckCircle2, Clock, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  created: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/40',
  attempted: 'bg-blue-900/30 text-blue-300 border-blue-800/40',
  paid: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40',
  failed: 'bg-red-900/30 text-red-300 border-red-800/40',
  refunded: 'bg-violet-900/30 text-violet-300 border-violet-800/40',
}

const ENTITY_LABEL: Record<string, string> = {
  registration: 'Registration',
  business: 'Business Post',
}

export default async function PaymentsPage() {
  const configured = isSupabaseConfigured()

  let rows: any[] = []
  let tableMissing = false

  if (configured) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      // The payments table is added by supabase-payments.sql — tell the admin
      // exactly what to do instead of showing a blank page.
      tableMissing = true
    }
    rows = data ?? []
  }

  // Amounts are stored in paise; show rupees.
  const paid = rows.filter((r) => r.status === 'paid')
  const pending = rows.filter((r) => r.status === 'created' || r.status === 'attempted')
  const failed = rows.filter((r) => r.status === 'failed')
  const collected = paid.reduce((sum, r) => sum + (r.amount ?? 0), 0) / 100

  return (
    <div className="p-6 sm:p-10">
      <AdminHeader
        title="Payments"
        subtitle={
          configured && !tableMissing
            ? `${rows.length} transaction${rows.length === 1 ? '' : 's'}`
            : 'Razorpay transactions'
        }
      />

      {!configured && <NotConfigured />}

      {tableMissing && (
        <div className="lux-card p-6 border-yellow-800/40 mb-6">
          <h3 className="font-cinzel text-yellow-300 text-lg mb-2">Payments table not created yet</h3>
          <p className="font-cormorant text-[16px] text-cream/70 leading-relaxed">
            Open your Supabase project → <strong>SQL Editor</strong> → <strong>New query</strong>,
            paste the contents of <code className="text-gold-light">supabase-payments.sql</code>{' '}
            from the project folder, and click <strong>Run</strong>. Then refresh this page.
          </p>
        </div>
      )}

      {configured && !tableMissing && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Collected" value={formatINR(collected)} icon={IndianRupee} accent />
            <StatCard label="Successful" value={paid.length} icon={CheckCircle2} />
            <StatCard label="Awaiting Payment" value={pending.length} icon={Clock} />
            <StatCard label="Failed" value={failed.length} icon={XCircle} />
          </div>

          {rows.length === 0 ? (
            <p className="font-cormorant text-[17px] text-cream/45 py-10 text-center">
              No payments yet. They appear here as soon as someone pays.
            </p>
          ) : (
            <div className="lux-card p-6 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gold/10">
                    {['Date', 'For', 'Amount', 'Status', 'Method', 'Payer', 'Razorpay ID'].map((h) => (
                      <th
                        key={h}
                        className="font-montserrat text-[9px] tracking-[0.2em] uppercase text-cream/40 py-3 pr-4 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gold/5 hover:bg-gold/5">
                      <td className="py-3 pr-4 font-cormorant text-[14px] text-cream/45 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="py-3 pr-4 font-cormorant text-[15px] text-cream/70 whitespace-nowrap">
                        {ENTITY_LABEL[r.entity_type] ?? r.entity_type}
                      </td>
                      <td className="py-3 pr-4 font-cinzel text-[15px] text-gold-light whitespace-nowrap">
                        {formatINR((r.amount ?? 0) / 100)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`font-montserrat text-[9px] tracking-wide uppercase px-2 py-1 border ${
                            STATUS_BADGE[r.status] ?? ''
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-montserrat text-[11px] uppercase text-cream/55">
                        {r.method ?? '—'}
                      </td>
                      <td className="py-3 pr-4 font-cormorant text-[14px] text-cream/60 whitespace-nowrap">
                        {r.email ?? '—'}
                        {r.contact ? <span className="text-cream/35"> · {r.contact}</span> : null}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-cream/40 whitespace-nowrap">
                        {r.payment_id ?? r.order_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
