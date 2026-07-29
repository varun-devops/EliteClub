# Going live — Vercel + eliteclubofficial.com

Your setup:

| Piece | Where |
|-------|-------|
| Code | GitHub — `varun-devops/EliteClub` |
| Hosting | **Vercel** (free plan) — project `prj_ZPN4dtAc5YR7eE7qqtLPSuVhC91T` |
| Domain | `eliteclubofficial.com` — DNS managed in **Hostinger hPanel** |
| Database | Supabase |
| Payments | Razorpay |

Do steps 1–5 once. After that **every `git push` publishes the site automatically.**

> Your Hostinger **Premium Web Hosting** plan runs PHP only and cannot run this app.
> Keep it for email on your domain — the website itself runs on Vercel.

---

## 1. Connect the GitHub repo to your Vercel project

1. Go to **https://vercel.com/dashboard** and open your project.
2. **Settings** → **Git** → **Connect Git Repository**.
3. Pick `varun-devops/EliteClub`, production branch **`main`**.

Leave the build settings alone — Vercel detects Next.js by itself:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `next build` (default) |
| Install Command | `npm install` (default) |
| Output Directory | leave empty |
| Node.js Version | 22.x |

---

## 2. Add your environment variables

**Settings** → **Environment Variables**. Add each one below, ticked for
**Production**, **Preview** and **Development**.

Copy the values from your local `.env.local`.

| Name | Notes |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — service_role key |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | the unsigned preset |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_…` for now |
| `RAZORPAY_KEY_SECRET` | **secret** |
| `RAZORPAY_WEBHOOK_SECRET` | any long random string — you'll paste the same one into Razorpay in step 5 |
| `ADMIN_EMAIL` | `eliteclub@gmail.com` |
| `ADMIN_PASSWORD` | your admin password |
| `ADMIN_SESSION_SECRET` | long random string |

> **Changing a variable later does not update the live site by itself.**
> After editing, go to **Deployments** → latest → **⋯** → **Redeploy**.

Generate a random string with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. First deploy

**Deployments** → **Redeploy** (or just push any commit).

When it goes green, open the `*.vercel.app` URL Vercel gives you and check:

- the home page loads
- `/register/photographer` submits successfully
- `/admin` accepts your email + password

Fix anything broken here **before** attaching the real domain.

---

## 4. Point eliteclubofficial.com at Vercel

### 4a. Tell Vercel about the domain

**Settings** → **Domains** → **Add** → `eliteclubofficial.com`.
Add `www.eliteclubofficial.com` too and let Vercel redirect one to the other.

Vercel will show you the DNS records it wants. They will look like this:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

**Use the exact values Vercel shows you**, not the ones above — they change.

### 4b. Update DNS — in Hostinger, NOT GoDaddy

The domain is **registered** at GoDaddy, but its **nameservers point to Hostinger**:

```
eliteclubofficial.com  nameserver = atlas.dns-parking.com
eliteclubofficial.com  nameserver = hyperion.dns-parking.com
```

Whoever the nameservers point to is the one who answers DNS. So **editing records in
GoDaddy will do nothing.** All DNS changes happen in Hostinger hPanel.

Go to hPanel → **Domains** → `eliteclubofficial.com` → **DNS / Nameservers** → **DNS Records**.

#### Delete these

| Type | Name | Current value | Why |
|------|------|---------------|-----|
| `A` | `@` | `91.108.106.238` | shared hosting |
| `A` | `@` | `93.127.173.97` | shared hosting |
| `AAAA` | `@` | `2a02:4780:...` | **IPv6 — easy to miss** |
| `A` / `CNAME` | `www` | anything Hostinger | replaced below |

> **Delete the `AAAA` records too.** If you remove only the `A` records, visitors on IPv6
> connections still reach Hostinger and see the wrong page, while you see the right one.
> This is the single most common reason a domain move "half works".

#### Keep these — do not touch

| Type | Name | Value | Why |
|------|------|-------|-----|
| `MX` | `@` | `mx1.hostinger.com` (priority 5) | **your email** |
| `MX` | `@` | `mx2.hostinger.com` (priority 10) | **your email** |
| `TXT` | `@` | SPF / DKIM / verification | email delivery |
| `CNAME` | `autodiscover`, `autoconfig` etc. | Hostinger | email clients |

Deleting an `MX` record stops mail to your domain immediately.

#### Add what Vercel gave you

| Type | Name | Value | TTL |
|------|------|-------|-----|
| `A` | `@` | the IP shown on Vercel's Domains page | 300 |
| `CNAME` | `www` | `cname.vercel-dns.com` | 300 |

**Use the exact values from Vercel's Domains page** — Vercel changes them from time to
time, so do not copy an IP out of a guide.

DNS takes 15 minutes to a few hours. Check with:

```powershell
nslookup eliteclubofficial.com 8.8.8.8
```

When that returns Vercel's IP (and no Hostinger IP), the Domains page in Vercel turns
green and HTTPS is issued automatically.

When it returns Vercel's IP, the **Domains** page in Vercel turns green and HTTPS is
issued automatically. No certificate to buy or install.

---

## 5. Point Razorpay at the live domain

Now that you have a real HTTPS address, webhooks can reach you.

Razorpay Dashboard → **Settings** → **Webhooks** → **Add New Webhook**:

| Field | Value |
|-------|-------|
| Webhook URL | `https://eliteclubofficial.com/api/payment/webhook` |
| Secret | the exact same string as `RAZORPAY_WEBHOOK_SECRET` in Vercel |
| Active Events | `payment.captured`, `payment.failed` |

Then test the whole flow on the live site:

1. Go to `/hire` and post a requirement (₹1,100 fee).
2. Pay with test UPI `success@razorpay`.
3. Open `/admin` → **Payments** — the transaction should show **paid**.

> Test and Live mode have **separate** webhooks. When you switch to `rzp_live_` keys,
> add the webhook again in Live mode.

---

## Everyday use

| What | How |
|------|-----|
| Publish a change | `git push` — Vercel builds and deploys on its own |
| See build logs | Vercel → **Deployments** → click the build |
| Change a secret | **Settings** → **Environment Variables**, then **Redeploy** |
| Undo a bad deploy | **Deployments** → pick the last good one → **Promote to Production** |
| Runtime errors | Vercel → **Logs** |

---

## When something breaks

**Build fails: "supabaseUrl is required"** — an environment variable is missing in Vercel.
Add it, then redeploy.

**Site works but forms fail** — `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong. It is the
`service_role` key, not the `anon` one.

**"Online payment is not enabled yet"** — `NEXT_PUBLIC_RAZORPAY_KEY_ID` or
`RAZORPAY_KEY_SECRET` is missing in Vercel. Note that `NEXT_PUBLIC_*` values are baked in at
**build** time, so you must **redeploy** after adding them — a restart is not enough.

**Domain stuck on "Invalid Configuration"** — the old Hostinger `A` record is still there.
Delete it. Only Vercel's records should remain for `@` and `www`.

**Webhook failing in the Razorpay dashboard** — the secret must match Vercel's
`RAZORPAY_WEBHOOK_SECRET` character for character.

**Email stopped working** — an `MX` record was deleted during step 4b. Restore it in
hPanel; Hostinger's default `MX` records are documented in their knowledge base.

---

## If you ever move to a VPS

The Hostinger VPS setup (PM2, Nginx, deploy script, GitHub Actions) was written and
tested — it is kept in git history, not deleted:

```bash
git show 5c695cb --stat
git checkout 5c695cb -- scripts deploy ecosystem.config.cjs .github
```
