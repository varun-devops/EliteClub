'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import Logo from '@/components/Logo'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed.')
        setLoading(false)
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6"><Logo size={64} href={null} /></div>
          <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-5">
            <Shield size={24} className="text-gold" />
          </div>
          <h1 className="font-cinzel text-2xl text-gold-light tracking-widest mb-1">Admin Panel</h1>
          <p className="font-cormorant text-[16px] text-cream/45">Elite Club Control Center</p>
        </div>

        <form onSubmit={handleSubmit} className="lux-card p-8 space-y-5">
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 text-red-400 font-cormorant text-[15px] px-4 py-3">
              {error}
            </div>
          )}
          <div>
            <label className="field-label">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="field pr-11"
                placeholder="you@example.com"
              />
              <Mail
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="field pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 hover:text-gold"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? (<><Loader2 size={16} className="animate-spin" /> Verifying…</>) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
