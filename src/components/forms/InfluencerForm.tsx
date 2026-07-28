'use client'

import { useState, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Field, Input, Select, PillGroup, Textarea } from './Fields'
import FileUpload from './FileUpload'
import SuccessCard, { type PendingPayment } from './SuccessCard'
import {
  INDIAN_STATES, CREATOR_CATEGORIES, FOLLOWER_BUCKETS, PACKAGES, FEES,
} from '@/lib/constants'
import { ageCategoryFromDOB, formatINR } from '@/lib/utils'
import { useSlots } from '@/components/useSlots'
import FreeOffer from '@/components/home/FreeOffer'

export default function InfluencerForm() {
  const params = useSearchParams()
  const presetPackage = params.get('package') ?? 'none'
  const { slots } = useSlots()
  // The base registration fee for THIS user (₹0 while free spots remain).
  const baseFee = slots.free ? 0 : FEES.influencerRegistration

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<
    null | { title: string; message: string; payment: PendingPayment | null }
  >(null)

  const [dob, setDob] = useState('')
  const [pkg, setPkg] = useState(presetPackage)
  const [languages, setLanguages] = useState<string[]>([])
  const [photo, setPhoto] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<string | null>(null)
  const [video, setVideo] = useState<string | null>(null)
  const [govtId, setGovtId] = useState<string | null>(null)

  const ageCategory = ageCategoryFromDOB(dob)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      role: 'influencer',
      full_name: fd.get('full_name'),
      gender: fd.get('gender'),
      date_of_birth: dob,
      age_category: ageCategory,
      mobile: fd.get('mobile'),
      email: fd.get('email'),
      address: fd.get('address'),
      state: fd.get('state'),
      district: fd.get('district'),
      city: fd.get('city'),
      instagram: fd.get('instagram'),
      facebook: fd.get('facebook'),
      youtube: fd.get('youtube'),
      linkedin: fd.get('linkedin'),
      website: fd.get('website'),
      followers: fd.get('followers'),
      category: fd.get('category'),
      languages,
      package: pkg,
      photo_url: photo,
      portfolio_url: portfolio,
      video_url: video,
      govt_id_url: govtId,
    }

    try {
      const res = await fetch('/api/register', {
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
        title: 'Welcome to Elite Club',
        message: data.message,
        payment: data.paymentEnabled
          ? { entityType: 'registration', entityId: data.id, amount: data.fee }
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
      {/* Launch offer */}
      <FreeOffer variant="inline" />

      {/* Personal */}
      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          Personal Information
        </h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Full Name" required>
            <Input name="full_name" required placeholder="Your full name" />
          </Field>
          <Field label="Gender" required>
            <Select name="gender" required options={['male', 'female', 'other']} placeholder="Select gender" />
          </Field>
          <Field label="Date of Birth" required hint={ageCategory ? `Category: ${ageCategory}` : 'Used to determine your age category'}>
            <Input type="date" name="date_of_birth" required value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Mobile Number" required>
            <Input name="mobile" required inputMode="tel" placeholder="+91 ..." />
          </Field>
          <Field label="Email" required>
            <Input type="email" name="email" required placeholder="you@example.com" />
          </Field>
          <Field label="Languages">
            <Input name="_lang_display" readOnly value={languages.join(', ')} placeholder="Pick below" />
          </Field>
        </div>
        <Field label="Address">
          <Textarea name="address" rows={2} placeholder="Your address" />
        </Field>
        <Field label="Languages you create in">
          <PillGroup
            value={languages}
            onChange={setLanguages}
            options={['Hindi', 'English', 'Punjabi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Malayalam', 'Other']}
          />
        </Field>
      </section>

      {/* Representation */}
      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          State & Category
        </h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="State you represent" required>
            <Select name="state" required options={INDIAN_STATES} placeholder="Select your state" />
          </Field>
          <Field label="District">
            <Input name="district" placeholder="District" />
          </Field>
          <Field label="City">
            <Input name="city" placeholder="City" />
          </Field>
          <Field label="Creator Category" required>
            <Select name="category" required options={CREATOR_CATEGORIES} placeholder="Select category" />
          </Field>
        </div>
      </section>

      {/* Social */}
      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          Social Presence
        </h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Instagram"><Input name="instagram" placeholder="@handle or URL" /></Field>
          <Field label="Total Followers">
            <Select name="followers" options={FOLLOWER_BUCKETS} placeholder="Select range" />
          </Field>
          <Field label="Facebook"><Input name="facebook" placeholder="Profile/Page URL" /></Field>
          <Field label="YouTube"><Input name="youtube" placeholder="Channel URL" /></Field>
          <Field label="LinkedIn"><Input name="linkedin" placeholder="Profile URL" /></Field>
          <Field label="Website"><Input name="website" placeholder="https://" /></Field>
        </div>
      </section>

      {/* Uploads */}
      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          Upload Your Profile
        </h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <FileUpload label="Professional Photo" kind="image" accept="image/*" value={photo} onChange={setPhoto} folder="elite-club/influencers/photos" />
          <FileUpload label="Portfolio (PDF / Image)" kind="auto" accept="image/*,application/pdf" value={portfolio} onChange={setPortfolio} folder="elite-club/influencers/portfolios" />
          <FileUpload label="Introduction Video" kind="video" accept="video/*" value={video} onChange={setVideo} folder="elite-club/influencers/videos" />
          <FileUpload label="Government ID" kind="image" accept="image/*,application/pdf" value={govtId} onChange={setGovtId} folder="elite-club/influencers/ids" />
        </div>
      </section>

      {/* Package */}
      <section className="space-y-5">
        <h3 className="font-cinzel text-gold-light text-lg border-b border-gold/15 pb-2">
          Membership Package <span className="font-cormorant text-cream/40 text-sm">(optional)</span>
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PackageOption
            id="none"
            name="Registration Only"
            price={baseFee === 0 ? 'FREE' : formatINR(baseFee)}
            note={baseFee === 0 ? `₹${FEES.influencerRegistration.toLocaleString('en-IN')}` : undefined}
            active={pkg === 'none'}
            onClick={() => setPkg('none')}
          />
          {PACKAGES.map((p) => (
            <PackageOption
              key={p.id}
              id={p.id}
              name={p.name}
              price={formatINR(p.price)}
              active={pkg === p.id}
              onClick={() => setPkg(p.id)}
            />
          ))}
        </div>
      </section>

      <div className="pt-2">
        <p className="font-montserrat text-[10px] text-cream/35 mb-4 leading-relaxed">
          {baseFee === 0 ? (
            <>
              <span className="text-orange-400">Registration is FREE</span> for the first 100 users
              (normally ₹1,100) — {slots.remaining} spots left. Optional packages are billed
              separately. Our team will verify your profile after submission.
            </>
          ) : (
            <>
              Registration fee ₹1,100 (plus package, if selected). Our team will share payment
              details and verify your profile after submission.
            </>
          )}
        </p>
        <button type="submit" disabled={submitting} className="btn-gold w-full">
          {submitting ? (<><Loader2 size={16} className="animate-spin" /> Submitting…</>) : 'Submit Registration'}
        </button>
      </div>
    </form>
  )
}

function PackageOption({
  name, price, note, active, onClick,
}: {
  id: string; name: string; price: string; note?: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 border transition-all ${
        active ? 'border-orange-500 bg-orange-500/10' : 'border-white/15 hover:border-orange-500/45'
      }`}
    >
      <span className="block font-cinzel text-cream text-[15px] leading-tight">{name}</span>
      <span className="flex items-baseline gap-2 mt-1">
        <span className={`font-cinzel text-lg ${active ? 'text-gold-gradient' : 'text-cream/55'}`}>
          {price}
        </span>
        {note && (
          <span className="font-cormorant text-sm text-cream/40 line-through">{note}</span>
        )}
      </span>
    </button>
  )
}
