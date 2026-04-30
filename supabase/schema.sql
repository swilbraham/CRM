-- Multi-tenant CRM schema for Supabase.
-- Each authenticated user owns an isolated workspace; rows are scoped by user_id
-- and protected by Row Level Security so the database itself enforces isolation.

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  created_at timestamptz default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  short_name text,
  color text,
  logo text,
  phone text,
  email text,
  address text,
  vat_number text,
  created_at timestamptz default now()
);
create index if not exists companies_user_idx on companies(user_id);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  city text,
  postcode text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists customers_user_idx on customers(user_id);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  status text default 'lead',
  date date,
  source text,
  notes text,
  items jsonb default '[]'::jsonb,
  invoice_no int,
  quote_no int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists jobs_user_idx on jobs(user_id);
create index if not exists jobs_customer_idx on jobs(customer_id);
create index if not exists jobs_status_idx on jobs(status);

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_invoice_no int default 1001,
  next_quote_no int default 2001,
  active_company_filter text default 'all'
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table profiles enable row level security;
alter table companies enable row level security;
alter table customers enable row level security;
alter table jobs enable row level security;
alter table user_settings enable row level security;

drop policy if exists "own_profile" on profiles;
create policy "own_profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own_companies" on companies;
create policy "own_companies" on companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_customers" on customers;
create policy "own_customers" on customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_jobs" on jobs;
create policy "own_jobs" on jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_settings" on user_settings;
create policy "own_settings" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- AUTO-PROVISION ON SIGNUP
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- updated_at maintenance
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_touch on customers;
create trigger customers_touch
  before update on customers
  for each row execute function public.touch_updated_at();

drop trigger if exists jobs_touch on jobs;
create trigger jobs_touch
  before update on jobs
  for each row execute function public.touch_updated_at();
