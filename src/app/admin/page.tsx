import Link from 'next/link'
import { Users, Crown, Camera, Video, Building2, MessageSquare, Clock, BadgeCheck, IndianRupee } from 'lucide-react'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin'
import StatCard from '@/components/admin/StatCard'
import AdminHeader from '@/components/admin/AdminHeader'
import NotConfigured from '@/components/admin/NotConfigured'
import { formatDate, formatINR } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function getStats() {
  const supabase = createAdminClient()
  const countOf = async (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true })
    if (filter) q = filter(q)
    const { count } = await q
    return count ?? 0
  }

  // The payments table may not exist yet (supabase-payments.sql), so this is
  // read separately and degrades to zero instead of breaking the dashboard.
  const paidTotal = async () => {
    const { data, error } = await supabase.from('payments').select('amount').eq('status', 'paid')
    if (error || !data) return 0
    return data.reduce((sum: number, r: any) => sum + (r.amount ?? 0), 0) / 100
  }

  const [
    totalReg, influencers, photographers, videographers,
    pendingReg, verifiedReg, businesses, enquiries, recent, collected,
  ] = await Promise.all([
    countOf('registrations'),
    countOf('registrations', (q) => q.eq('role', 'influencer')),
    countOf('registrations', (q) => q.eq('role', 'photographer')),
    countOf('registrations', (q) => q.eq('role', 'videographer')),
    countOf('registrations', (q) => q.eq('status', 'submitted')),
    countOf('registrations', (q) => q.eq('is_verified', true)),
    countOf('business_posts'),
    countOf('enquiries'),
    supabase
      .from('registrations')
      .select('id, full_name, role, state, status, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    paidTotal(),
  ])

  return {
    totalReg, influencers, photographers, videographers,
    pendingReg, verifiedReg, businesses, enquiries, collected,
    recent: recent.data ?? [],
  }
}

const ROLE_BADGE: Record<string, string> = {
  influencer: 'text-gold-light',
  photographer: 'text-sky-300',
  videographer: 'text-violet-300',
}
const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/40',
  under_review: 'bg-blue-900/30 text-blue-300 border-blue-800/40',
  verified: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40',
  rejected: 'bg-red-900/30 text-red-300 border-red-800/40',
}

export default async function AdminDashboard() {
  const configured = isSupabaseConfigured()
  const stats = configured
    ? await getStats()
    : { totalReg: 0, influencers: 0, photographers: 0, videographers: 0, pendingReg: 0, verifiedReg: 0, businesses: 0, enquiries: 0, collected: 0, recent: [] as any[] }

  return (
    <div className="p-6 sm:p-10">
      <AdminHeader title="Dashboard" subtitle="Overview of platform activity" />

      {!configured && <NotConfigured />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Registrations" value={stats.totalReg} icon={Users} href="/admin/registrations" accent />
        <StatCard label="Pending Review" value={stats.pendingReg} icon={Clock} href="/admin/registrations?status=submitted" />
        <StatCard label="Verified" value={stats.verifiedReg} icon={BadgeCheck} href="/admin/registrations?verified=1" />
        <StatCard label="Business Posts" value={stats.businesses} icon={Building2} href="/admin/businesses" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Influencers" value={stats.influencers} icon={Crown} href="/admin/registrations?role=influencer" />
        <StatCard label="Photographers" value={stats.photographers} icon={Camera} href="/admin/registrations?role=photographer" />
        <StatCard label="Videographers" value={stats.videographers} icon={Video} href="/admin/registrations?role=videographer" />
        <StatCard label="Collected" value={formatINR(stats.collected)} icon={IndianRupee} href="/admin/payments" />
        <StatCard label="Enquiries" value={stats.enquiries} icon={MessageSquare} href="/admin/enquiries" />
      </div>

      <div className="lux-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-cinzel text-xl text-gold-light">Recent Registrations</h2>
          <Link href="/admin/registrations" className="font-montserrat text-[10px] tracking-[0.2em] uppercase text-gold hover:text-gold-light">
            View all →
          </Link>
        </div>

        {stats.recent.length === 0 ? (
          <p className="font-cormorant text-[16px] text-cream/45 py-6 text-center">
            {configured ? 'No registrations yet.' : 'Connect Supabase to see live submissions.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gold/10">
                  {['Name', 'Role', 'State', 'Status', 'Date'].map((h) => (
                    <th key={h} className="font-montserrat text-[9px] tracking-[0.2em] uppercase text-cream/40 py-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r: any) => (
                  <tr key={r.id} className="border-b border-gold/5 hover:bg-gold/5">
                    <td className="py-3 pr-4 font-cormorant text-[16px] text-cream/85">{r.full_name}</td>
                    <td className={`py-3 pr-4 font-montserrat text-[11px] uppercase tracking-wide ${ROLE_BADGE[r.role] ?? 'text-cream/60'}`}>{r.role}</td>
                    <td className="py-3 pr-4 font-cormorant text-[15px] text-cream/60">{r.state}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-montserrat text-[9px] tracking-wide uppercase px-2 py-1 border ${STATUS_BADGE[r.status] ?? ''}`}>
                        {r.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-cormorant text-[14px] text-cream/45 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
