create table if not exists access_codes (
  code text primary key,
  partner_name text not null,
  partner_tagline text,
  partner_accent text,
  is_claimed boolean not null default false,
  claimed_profile_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null references access_codes(code),
  first_name text not null,
  surname text not null,
  gender text not null,
  age int not null,
  created_at timestamptz not null default now()
);