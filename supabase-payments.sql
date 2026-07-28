-- ════════════════════════════════════════════════════════════════════
--  ELITE CLUB — Payments (Razorpay) migration
--
--  HOW TO RUN:
--    Supabase → SQL Editor → New query → paste this file → Run.
--    Run AFTER supabase-schema.sql. Safe to re-run.
--
--  One row per Razorpay order. This is the money audit trail — it stays
--  even if a registration is later edited or rejected.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

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

  -- money. NOTE: amount is in PAISE (₹1,100 -> 110000), matching Razorpay.
  amount   integer not null,
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

-- keep updated_at fresh (function is defined in supabase-schema.sql)
drop trigger if exists trg_payments_touch on public.payments;
create trigger trg_payments_touch before update on public.payments
  for each row execute procedure public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
--  ROW LEVEL SECURITY
--  Same posture as the other tables: RLS on, no public policies. Only
--  the server-side service-role key (which bypasses RLS) may touch this.
-- ─────────────────────────────────────────────────────────────────────
alter table public.payments enable row level security;

-- ════════════════════════════════════════════════════════════════════
--  Done. Table: payments.
-- ════════════════════════════════════════════════════════════════════
