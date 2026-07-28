# Elite Club — *Reserved for Rare*

India's Premier Luxury Talent & Brand Collaboration Platform.

A full-stack Next.js 16 web app: a cinematic, parallax landing page; registration flows for
influencers, photographers, and videographers; a business "hire talent" portal; a partner
enquiry flow; and a password-protected admin panel to verify and manage every submission.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (luxury black & gold theme, Cinzel / Cormorant / Montserrat)
- **Framer Motion** — scroll-driven parallax hero & sections
- **Supabase** (Postgres) — stores all registrations, business posts, enquiries
- **Cloudinary** — unsigned uploads for photos, portfolios, videos, government IDs
- **Razorpay** — UPI / cards / net banking, with signature-verified webhooks

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

The public site works immediately. To enable form submissions + the admin panel,
follow **[SETUP.md](./SETUP.md)** (Supabase + Cloudinary keys, ~10 minutes).

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page (parallax hero, championship, packages, discovery) |
| `/register` | Choose a membership type |
| `/register/influencer` | Influencer registration (₹1,100, with packages) |
| `/register/photographer` | Photographer registration (free) |
| `/register/videographer` | Videographer registration (free) |
| `/hire` | Business requirement portal (₹1,100 posting) |
| `/partner` | Sponsor / partner enquiry |
| `/admin` | Admin panel (dashboard, registrations, businesses, enquiries) |

## Admin panel

Visit `/admin`, log in with `ADMIN_PASSWORD` (from `.env.local`). You can review every
submission, open uploaded files, change status, toggle verification, mark payments paid,
and leave internal notes. Access is protected by signed-cookie middleware.

See **[SETUP.md](./SETUP.md)** for full configuration and deployment instructions.
