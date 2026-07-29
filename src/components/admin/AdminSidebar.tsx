'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Building2, MessageSquare, IndianRupee, LogOut, ExternalLink } from 'lucide-react'
import Logo from '@/components/Logo'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/registrations', label: 'Registrations', icon: Users },
  { href: '/admin/businesses', label: 'Business Posts', icon: Building2 },
  { href: '/admin/payments', label: 'Payments', icon: IndianRupee },
  { href: '/admin/enquiries', label: 'Enquiries', icon: MessageSquare },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 bg-ink-2 border-r border-gold/15 min-h-screen flex flex-col sticky top-0">
      <div className="p-5 border-b border-gold/10">
        <Logo size={42} withText href="/admin" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 font-montserrat text-[12px] tracking-[0.12em] uppercase transition-colors ${
                active
                  ? 'bg-orange-500/12 text-orange-400 border-l-2 border-orange-500'
                  : 'text-cream/55 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gold/10 space-y-1">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-4 py-3 font-montserrat text-[12px] tracking-[0.12em] uppercase text-cream/45 hover:text-gold transition-colors"
        >
          <ExternalLink size={16} /> View Site
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 font-montserrat text-[12px] tracking-[0.12em] uppercase text-cream/45 hover:text-red-400 transition-colors"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  )
}
