-- ════════════════════════════════════════════════════════════════════
--  ELITE CLUB — Supabase Schema
--  "Reserved for Rare"
--
--  HOW TO RUN:
--    1. Open your Supabase project → SQL Editor → New query
--    2. Paste this ENTIRE file and click "Run".
--  Safe to re-run (uses "if not exists" / "drop ... if exists").
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────
--  REGISTRATIONS
--  One table holds every talent/creative registration. The `role` column
--  distinguishes Influencer / Photographer / Videographer. Role-specific
--  fields are simply left null when not applicable.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.registrations (
  id uuid default uuid_generate_v4() primary key,

  -- which kind of member
  role text not null check (role in ('influencer','photographer','videographer')),

  -- personal info (common)
  full_name   text not null,
  gender      text check (gender in ('male','female','other')),
  date_of_birth date,
  age_category  text,                          -- e.g. 'Elite Teen (16-20)'
  mobile      text not null,
  email       text not null,
  address     text,
  state       text not null,                   -- Indian state the member represents
  district    text,
  city        text,

  -- social presence (mainly influencers, optional for others)
  instagram   text,
  facebook    text,
  youtube     text,
  linkedin    text,
  website     text,
  followers   text,                            -- free text bucket e.g. '10k-50k'

  -- categorisation
  category        text,                        -- creator category OR primary specialization
  specializations text[],                      -- photographer / videographer specializations (multi)
  experience      text,                        -- years of experience bucket
  languages       text[],

  -- uploaded asset URLs (Cloudinary)
  photo_url     text,                          -- professional photo
  portfolio_url text,                          -- portfolio (pdf/zip/link or image)
  video_url     text,                          -- introduction / showreel video
  govt_id_url   text,                          -- government ID

  -- membership package chosen by influencers (optional)
  package text check (package in ('none','starter','premium','signature')) default 'none',

  -- money & lifecycle
  fee_amount      integer not null default 0,  -- in INR. influencer=1100, photog/video=0
  payment_status  text not null default 'pending'
                   check (payment_status in ('pending','paid','waived','failed')),
  status          text not null default 'submitted'
                   check (status in ('submitted','under_review','verified','rejected')),
  is_verified     boolean not null default false,
  admin_notes     text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists registrations_role_idx    on public.registrations (role);
create index if not exists registrations_state_idx   on public.registrations (state);
create index if not exists registrations_status_idx  on public.registrations (status);
create index if not exists registrations_created_idx on public.registrations (created_at desc);

-- ─────────────────────────────────────────────────────────────────────
--  BUSINESS REQUIREMENT POSTS
--  Brands post a requirement (₹1,100 posting fee) to hire talent.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.business_posts (
  id uuid default uuid_generate_v4() primary key,

  company_name  text not null,
  business_type text,                          -- Luxury Brand / Fashion / Hotel / ...
  contact_name  text not null,
  email         text not null,
  mobile        text not null,
  website       text,
  state         text,
  city          text,

  hiring_for    text[],                        -- Influencers / Photographers / ...
  requirement   text not null,                 -- the brief
  budget        text,                          -- free text budget range
  logo_url      text,                          -- Cloudinary

  fee_amount     integer not null default 1100,
  payment_status text not null default 'pending'
                  check (payment_status in ('pending','paid','waived','failed')),
  status         text not null default 'submitted'
                  check (status in ('submitted','under_review','approved','rejected','fulfilled')),
  is_verified    boolean not null default false,
  admin_notes    text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists business_status_idx  on public.business_posts (status);
create index if not exists business_created_idx on public.business_posts (created_at desc);

-- ─────────────────────────────────────────────────────────────────────
--  GENERIC CONTACT / PARTNER / SPONSOR ENQUIRIES
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.enquiries (
  id uuid default uuid_generate_v4() primary key,
  kind    text not null default 'contact'
           check (kind in ('contact','partner','sponsor')),
  name    text not null,
  email   text not null,
  mobile  text,
  company text,
  message text,
  status  text not null default 'new' check (status in ('new','read','closed')),
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────
--  PAYMENTS (Razorpay)
--  One row per Razorpay order — the money audit trail. It is kept even
--  if the registration it belongs to is later edited or rejected.
--  NOTE: `amount` is in PAISE (₹1,100 -> 110000), matching Razorpay.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid default uuid_generate_v4() primary key,

  -- what is being paid for
  entity_type text not null check (entity_type in ('registration','business')),
  entity_id   uuid not null,          -- registrations.id or business_posts.id

  -- gateway identifiers
  gateway    text not null default 'razorpay',
  order_id   text not null unique,    -- Razorpay order_id  (order_XXXXXXXX)
  payment_id text,                    -- Razorpay payment_id (pay_XXXXXXXX)
  signature  text,                    -- checkout signature we verified

  amount   integer not null,          -- PAISE
  currency text not null default 'INR',

  status text not null default 'created'
          check (status in ('created','attempted','paid','failed','refunded')),
  method text,                        -- upi / card / netbanking / wallet

  -- payer contact as captured at order time (helps reconcile disputes)
  email   text,
  contact text,

  error_description text,
  paid_at    timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists payments_entity_idx     on public.payments (entity_type, entity_id);
create index if not exists payments_payment_id_idx on public.payments (payment_id);
create index if not exists payments_status_idx     on public.payments (status);
create index if not exists payments_created_idx    on public.payments (created_at desc);

-- ─────────────────────────────────────────────────────────────────────
--  keep updated_at fresh
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_registrations_touch on public.registrations;
create trigger trg_registrations_touch before update on public.registrations
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_business_touch on public.business_posts;
create trigger trg_business_touch before update on public.business_posts
  for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_payments_touch on public.payments;
create trigger trg_payments_touch before update on public.payments
  for each row execute procedure public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
--  ROW LEVEL SECURITY
--
--  All writes from the website go through Next.js server routes that use
--  the SERVICE-ROLE key, which BYPASSES RLS. So we keep RLS ENABLED with
--  no public policies — meaning the anon/public key cannot read or write
--  these tables directly from the browser. This protects applicant PII.
-- ─────────────────────────────────────────────────────────────────────
alter table public.registrations  enable row level security;
alter table public.business_posts enable row level security;
alter table public.enquiries      enable row level security;
alter table public.payments       enable row level security;

-- (Intentionally NO permissive policies. Service-role bypasses RLS.)

-- ════════════════════════════════════════════════════════════════════
--  Done. Tables: registrations, business_posts, enquiries, payments.
-- ════════════════════════════════════════════════════════════════════
