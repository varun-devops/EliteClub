import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin'
import { ROLE_META } from '@/lib/constants'
import { countInfluencerRegistrations, deriveSlotInfo } from '@/lib/slots'
import { isRazorpayConfigured } from '@/lib/payments/razorpay'

export const runtime = 'nodejs'

type Body = Record<string, any>

const VALID_ROLES = ['influencer', 'photographer', 'videographer'] as const

function clean(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

function cleanArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const arr = v.map((x) => String(x).trim()).filter(Boolean)
  return arr.length ? arr : null
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const role = clean(body.role)
  if (!role || !VALID_ROLES.includes(role as any)) {
    return NextResponse.json({ error: 'Invalid registration type.' }, { status: 400 })
  }

  const full_name = clean(body.full_name)
  const mobile = clean(body.mobile)
  const email = clean(body.email)
  const state = clean(body.state)

  const missing: string[] = []
  if (!full_name) missing.push('full name')
  if (!mobile) missing.push('mobile number')
  if (!email) missing.push('email')
  if (!state) missing.push('state')
  if (missing.length) {
    return NextResponse.json(
      { error: `Please provide your ${missing.join(', ')}.` },
      { status: 400 }
    )
  }

  // basic email / phone sanity
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email!)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!/^[0-9+\-\s()]{7,15}$/.test(mobile!)) {
    return NextResponse.json({ error: 'Please enter a valid mobile number.' }, { status: 400 })
  }

  const pkg = clean(body.package)

  // If Supabase isn't configured yet, fail gracefully with a clear message
  // (so the form still demonstrably "works" end-to-end in dev).
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          'Supabase is not configured yet. Add your keys to .env.local (see SETUP.md), then try again.',
        code: 'NOT_CONFIGURED',
      },
      { status: 503 }
    )
  }

  // Resolve the fee server-side (authoritative). Influencers are free for the
  // first FREE_SLOT_LIMIT registrations; after that the standard fee applies.
  // Counting just before insert keeps the window for races tiny.
  let fee = ROLE_META[role as keyof typeof ROLE_META].fee
  if (role === 'influencer') {
    try {
      const used = await countInfluencerRegistrations()
      fee = deriveSlotInfo(used).nextFee
    } catch {
      // If the count fails, fall back to the standard influencer fee so we
      // never silently give away a paid slot.
      fee = ROLE_META.influencer.fee
    }
  }

  const record = {
    role,
    full_name,
    gender: clean(body.gender),
    date_of_birth: clean(body.date_of_birth),
    age_category: clean(body.age_category),
    mobile,
    email,
    address: clean(body.address),
    state,
    district: clean(body.district),
    city: clean(body.city),
    instagram: clean(body.instagram),
    facebook: clean(body.facebook),
    youtube: clean(body.youtube),
    linkedin: clean(body.linkedin),
    website: clean(body.website),
    followers: clean(body.followers),
    category: clean(body.category),
    specializations: cleanArray(body.specializations),
    experience: clean(body.experience),
    languages: cleanArray(body.languages),
    photo_url: clean(body.photo_url),
    portfolio_url: clean(body.portfolio_url),
    video_url: clean(body.video_url),
    govt_id_url: clean(body.govt_id_url),
    package: pkg && ['starter', 'premium', 'signature'].includes(pkg) ? pkg : 'none',
    fee_amount: fee,
    payment_status: fee === 0 ? 'waived' : 'pending',
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('registrations')
      .insert(record)
      .select('id')
      .single()

    if (error) {
      console.error('[register] insert error:', error)
      return NextResponse.json(
        { error: 'Could not save your registration. Please try again.' },
        { status: 500 }
      )
    }

    const isFreeInfluencer = role === 'influencer' && fee === 0

    // When the gateway is live the user pays right here; otherwise we fall back
    // to the original "our team will share payment details" flow.
    const paymentEnabled = fee > 0 && isRazorpayConfigured()

    return NextResponse.json({
      ok: true,
      id: data.id,
      fee,
      requiresPayment: fee > 0,
      paymentEnabled,
      message:
        fee > 0
          ? paymentEnabled
            ? `Registration received! Complete your ₹${fee.toLocaleString(
                'en-IN'
              )} payment below to confirm your spot.`
            : `Registration received! A fee of ₹${fee.toLocaleString('en-IN')} applies. Our team will share payment details and verify your profile shortly.`
          : isFreeInfluencer
            ? 'Registration received — and your fee is waived! You claimed one of the first 100 free spots. Our team will verify your profile shortly.'
            : 'Registration received! Our team will verify your profile shortly.',
    })
  } catch (e) {
    console.error('[register] unexpected:', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
