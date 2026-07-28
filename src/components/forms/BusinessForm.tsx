'use client'

import { useState, FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Field, Input, Select, PillGroup, Textarea } from './Fields'
import FileUpload from './FileUpload'
import SuccessCard, { type PendingPayment } from './SuccessCard'
import { INDIAN_STATES, BUSINESS_TYPES, HIRING_OPTIONS } from '@/lib/constants'

export default function BusinessForm() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<
    null | { title: string; message: string; payment: PendingPayment | null }
  >(null)
  const [hiringFor, setHiringFor] = useState<string[]>([])
  const [logo, setLogo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      company_name: fd.get('company_name'),
      business_type: fd.get('business_type'),
      contact_name: fd.get('contact_name'),
      email: fd.get('email'),
      mobile: fd.get('mobile'),
      website: fd.get('website'),
      state: fd.get('state'),
      city: fd.get('city'),
      hiring_for: hiringFor,
      requirement: fd.get('requirement'),
      budget: fd.get('budget'),
      logo_url: logo,
    }
    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Something went wrong.')
        setSubmitting(false)
        return
      }
      setDone({
        title: 'Requirement Posted',
        message: data.message,
        payment: data.paymentEnabled
          ? { entityType: 'business', entityId: data.id, amount: data.fee }
          : null,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (done) return <SuccessCard title={done.title} message={done.message} payment={done.payment} />

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          Company Details
        </h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Company / Brand Name" required>
            <Input name="company_name" required placeholder="Your company" />
          </Field>
          <Field label="Business Type">
            <Select name="business_type" options={BUSINESS_TYPES} placeholder="Select type" />
          </Field>
          <Field label="Contact Person" required>
            <Input name="contact_name" required placeholder="Full name" />
          </Field>
          <Field label="Email" required>
            <Input type="email" name="email" required placeholder="you@company.com" />
          </Field>
          <Field label="Mobile Number" required>
            <Input name="mobile" required inputMode="tel" placeholder="+91 ..." />
          </Field>
          <Field label="Website">
            <Input name="website" placeholder="https://" />
          </Field>
          <Field label="State">
            <Select name="state" options={INDIAN_STATES} placeholder="Select state" />
          </Field>
          <Field label="City">
            <Input name="city" placeholder="City" />
          </Field>
        </div>
        <Field label="Company Logo (optional)">
          <FileUpload label="Logo" kind="image" accept="image/*" value={logo} onChange={setLogo} folder="elite-club/business/logos" />
        </Field>
      </section>

      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          What You Need
        </h3>
        <Field label="Who do you want to hire?">
          <PillGroup value={hiringFor} onChange={setHiringFor} options={HIRING_OPTIONS} />
        </Field>
        <Field label="Requirement Details" required hint="Describe your campaign, deliverables, timeline, and any preferences.">
          <Textarea name="requirement" required rows={5} placeholder="Tell us about the campaign / project…" />
        </Field>
        <Field label="Budget Range">
          <Input name="budget" placeholder="e.g. ₹50,000 – ₹1,00,000" />
        </Field>
      </section>

      <div className="pt-2">
        <p className="font-montserrat text-[10px] text-cream/35 mb-4 leading-relaxed">
          Requirement posting fee ₹1,100. After submission, our team will shortlist verified
          talent matching your brief and share details along with payment instructions.
        </p>
        <button type="submit" disabled={submitting} className="btn-gold w-full">
          {submitting ? (<><Loader2 size={16} className="animate-spin" /> Posting…</>) : 'Post Requirement'}
        </button>
      </div>
    </form>
  )
}
