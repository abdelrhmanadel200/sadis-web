-- Phone OTP codes table.
--
-- Stores short-lived 4-digit verification codes hashed with a server-side
-- pepper so a DB leak by itself can't be replayed. One row per send; the
-- row is consumed on successful verify.

create table if not exists public.phone_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists phone_otp_codes_phone_created_idx
  on public.phone_otp_codes (phone, created_at desc);

create index if not exists phone_otp_codes_expires_idx
  on public.phone_otp_codes (expires_at);

-- Lock the table down — only the service role (used by our /api/phone-otp/*
-- routes) should ever read/write it. No client should touch it directly.
alter table public.phone_otp_codes enable row level security;
revoke all on public.phone_otp_codes from anon, authenticated;
