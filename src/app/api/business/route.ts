import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin'
import { FEES } from '@/lib/constants'
import { isRazorpayConfigured } from '@/lib/payments/razorpay'

export const runtime = 'nodejs'

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
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const company_name = clean(body.company_name)
  const contact_name = clean(body.contact_name)
  const email = clean(body.email)
  const mobile = clean(body.mobile)
  const requirement = clean(body.requirement)

  const missing: string[] = []
  if (!company_name) missing.push('company name')
  if (!contact_name) missing.push('contact name')
  if (!email) missing.push('email')
  if (!mobile) missing.push('mobile number')
  if (!requirement) missing.push('requirement details')
  if (missing.length) {
    return NextResponse.json(
      { error: `Please provide your ${missing.join(', ')}.` },
      { status: 400 }
    )
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email!)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const record = {
    company_name,
    business_type: clean(body.business_type),
    contact_name,
    email,
    mobile,
    website: clean(body.website),
    state: clean(body.state),
    city: clean(body.city),
    hiring_for: cleanArray(body.hiring_for),
    requirement,
    budget: clean(body.budget),
    logo_url: clean(body.logo_url),
    fee_amount: FEES.businessPosting,
    payment_status: 'pending',
  }

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

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('business_posts')
      .insert(record)
      .select('id')
      .single()
    if (error) {
      console.error('[business] insert error:', error)
      return NextResponse.json(
        { error: 'Could not submit your requirement. Please try again.' },
        { status: 500 }
      )
    }
    const fee = FEES.businessPosting
    const paymentEnabled = fee > 0 && isRazorpayConfigured()

    return NextResponse.json({
      ok: true,
      id: data.id,
      fee,
      requiresPayment: fee > 0,
      paymentEnabled,
      message: paymentEnabled
        ? `Requirement posted! Complete your ₹${fee.toLocaleString(
            'en-IN'
          )} posting fee below and our team will start shortlisting verified talent.`
        : `Requirement posted! A posting fee of ₹${fee.toLocaleString(
            'en-IN'
          )} applies. Our team will reach out with shortlisted talent and payment details.`,
    })
  } catch (e) {
    console.error('[business] unexpected:', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
