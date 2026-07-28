# Elite Club — Setup Guide

This is the **only file you need** to take the site from "running locally with placeholders"
to "fully working with a live database and file uploads."

Everything is already coded. You just paste 4–5 keys into `.env.local`, run one SQL file,
and you're live.

---

## 0. Run it locally (already works)

```bash
npm install        # already done
npm run dev        # → http://localhost:3000
```

The public site works right now. Forms and the admin panel will say "Supabase not configured"
until you do steps 1–3 below.

---

## 1. Supabase (free) — database

1. Go to **https://supabase.com** → create a free account → **New Project**.
   - Pick any name + a strong database password + a region close to India (e.g. Mumbai).
2. Wait ~2 minutes for it to provision.
3. **Create the tables:** left sidebar → **SQL Editor** → **New query** →
   open the file [`supabase-schema.sql`](./supabase-schema.sql) from this project, paste the
   **entire** contents, and click **Run**. You should see "Success."
4. **Get your keys:** left sidebar → **Project Settings** (gear) → **API**. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY`  *(keep this secret!)*

---

## 2. Cloudinary (free) — photo / video / ID uploads

1. Go to **https://cloudinary.com** → free account.
2. On the **Dashboard**, copy your **Cloud name** → `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
3. Create an **unsigned upload preset** (this lets the browser upload directly):
   - **Settings** (gear) → **Upload** tab → scroll to **Upload presets** → **Add upload preset**.
   - Set **Signing Mode** = **Unsigned**.
   - (Optional) set a folder like `elite-club`.
   - **Save**, then copy the **preset name** → `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

---

## 3. Fill in `.env.local`

Open [`.env.local`](./.env.local) and replace the placeholders:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...      # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...          # service_role secret

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset

ADMIN_PASSWORD=choose-a-strong-password
ADMIN_SESSION_SECRET=any-long-random-string-here
```

> Generate a strong session secret:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Restart the dev server** after editing `.env.local` (`Ctrl+C`, then `npm run dev`).

---

## 4. Use it

- **Public site:** http://localhost:3000
- **Register:** /register · /register/influencer · /register/photographer · /register/videographer
- **Hire talent:** /hire
- **Become a partner:** /partner
- **Admin panel:** http://localhost:3000/admin  (log in with your `ADMIN_PASSWORD`)

Submit a test registration, then open the admin panel → **Registrations** to see it,
view uploaded files, change status, mark verified, mark payment as paid, and add notes.

---

## 5. Deploy (Vercel — free)

1. Push this folder to a GitHub repo.
2. Go to **https://vercel.com** → **New Project** → import the repo.
3. In **Environment Variables**, add the **same keys** from your `.env.local`
   (all of them, including `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`).
4. Deploy. Your site is live. The admin cookie is automatically `Secure` in production.

---

## 6. Razorpay — take real payments into your bank account

Razorpay is wired in and ready. Until you add keys, the site keeps the old behaviour
(fee saved as `pending`, your team collects manually). The moment real keys are present,
a **Pay Securely** button appears on the confirmation screen automatically.

### 6a. Open the account (1–2 working days)

1. Sign up at **https://razorpay.com** with your business email.
2. Complete **KYC**: PAN, address proof, and **your bank account number + IFSC**.
   That bank account is where every payment eventually lands — get it right.
   - Sole proprietor / individual is accepted; a registered company gets approved faster.
3. While KYC is pending you already get **Test Mode** keys, so you can build and test today.

### 6b. Create the tables

Supabase → **SQL Editor** → **New query** → paste all of
[`supabase-payments.sql`](./supabase-payments.sql) → **Run**.

### 6c. Get your API keys

Razorpay Dashboard → **Account & Settings** → **API Keys** → **Generate Key**.
The secret is shown **once** — copy it immediately.

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx   # public, safe in the browser
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx            # SECRET — server only
```

### 6d. Set up the webhook (do not skip this)

The webhook is what protects you when a customer pays and then closes the tab before the
browser can tell your server. Razorpay calls you directly, server to server.

Razorpay Dashboard → **Settings** → **Webhooks** → **Add New Webhook**:

| Field | Value |
|-------|-------|
| Webhook URL | `https://your-domain.com/api/payment/webhook` |
| Secret | any long random string — paste the **same** value into `RAZORPAY_WEBHOOK_SECRET` |
| Active Events | `payment.captured` and `payment.failed` |

```env
RAZORPAY_WEBHOOK_SECRET=the-same-long-random-string
```

> Localhost has no public URL, so webhooks can't reach your laptop. Either test the webhook
> after deploying to Vercel, or tunnel with `npx localtunnel --port 3000`.

### 6e. Test before going live

With `rzp_test_` keys, submit a registration and pay using Razorpay's test instruments:

- **Card:** `4111 1111 1111 1111`, any future expiry, any CVV
- **UPI:** `success@razorpay` (and `failure@razorpay` to test a failed payment)

Then check: the `payments` row shows `status = paid`, and the registration in
`/admin` shows **Paid**.

### 6f. Go live

1. KYC approved → Razorpay Dashboard → switch to **Live Mode** → generate **live** keys.
2. Replace the keys in Vercel's Environment Variables with the `rzp_live_...` pair.
3. Add a **second webhook** for the live mode pointing at the same URL (test and live
   webhooks are configured separately).
4. Redeploy. Do one real ₹1 test payment to yourself before announcing.

### How the money reaches your bank

```
Customer pays (UPI / card / netbanking)
        ↓
Razorpay collects and auto-captures it
        ↓
Razorpay deducts its fee (~2% + 18% GST on that fee)
        ↓
T+2 working days — settled into your bank account, automatically
        ↓
Dashboard → Settlements shows every payout and its UTR
```

You do nothing to trigger payouts — they are automatic once your bank account is verified.
Settlement is **T+2 working days** by default (T+1 available on request for a small fee).

### What each part of the code does

| File | Role |
|------|------|
| `src/lib/payments/razorpay.ts` | Talks to Razorpay's API; verifies signatures |
| `src/lib/payments/orders.ts` | Links a Razorpay order to a registration / business post |
| `src/app/api/payment/order/route.ts` | Creates the order — **amount is read from the DB, never the browser** |
| `src/app/api/payment/verify/route.ts` | Confirms the payment when the browser returns |
| `src/app/api/payment/webhook/route.ts` | Razorpay → server safety net; the source of truth |
| `src/components/payments/PayNow.tsx` | The Pay button + Razorpay Checkout popup |

**Security note:** the browser only ever sends the submission `id`. The server looks up the
fee in the database, so a customer cannot edit the amount and pay ₹1 instead of ₹1,100.
Every payment is checked against Razorpay's HMAC signature before anything is marked paid.

---

## Where things live

| Area | Path |
|------|------|
| Landing page sections | `src/components/home/` |
| Registration forms | `src/components/forms/` |
| Public pages | `src/app/(public)/` |
| API routes | `src/app/api/` |
| Admin panel | `src/app/admin/` + `src/components/admin/` |
| Payments (Razorpay) | `src/lib/payments/` + `src/app/api/payment/` |
| Domain data (states, packages, fees, hero images) | `src/lib/constants.ts` |
| Database schema | `supabase-schema.sql` + `supabase-payments.sql` |

To swap the hero / parallax model photos, edit `HERO_IMAGES` in `src/lib/constants.ts`.
