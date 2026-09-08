import pg from 'pg'
import '../loadEnv.js'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })

  await client.connect()
  console.log('Running CRM migrations …')
  try {
    await client.query(`alter table customer_sub_stages add column if not exists stage_date date`)
    await client.query(`alter table documents add column if not exists custom_name text`)
    await client.query(`alter table documents add column if not exists storage_path text`)
    await client.query(`alter table photos add column if not exists storage_path text`)
    await client.query(`alter table customers add column if not exists is_active boolean not null default true`)
    await client.query(`alter table users add column if not exists is_active boolean not null default true`)
    await client.query(`alter table users add column if not exists mobile text`)
    await client.query(
      `alter table users add column if not exists is_system_admin boolean not null default false`
    )
    await client.query(`
      update users
      set is_system_admin = (username = 'vishal.wandile')
      where is_system_admin is distinct from (username = 'vishal.wandile')
    `)
    await client.query(`
      create unique index if not exists users_single_system_admin
      on users (is_system_admin)
      where is_system_admin = true
    `)
    await client.query(`
      create or replace function protect_system_admin()
      returns trigger
      language plpgsql
      as $$
      begin
        if tg_op = 'DELETE' and old.is_system_admin then
          raise exception 'The system administrator account cannot be deleted';
        end if;
        if tg_op = 'UPDATE'
           and old.is_system_admin
           and (not new.is_system_admin or not new.is_active) then
          raise exception 'The system administrator account cannot be deactivated or unprotected';
        end if;
        if tg_op = 'DELETE' then
          return old;
        end if;
        return new;
      end;
      $$;

      drop trigger if exists users_protect_system_admin on users;
      create trigger users_protect_system_admin
      before update or delete on users
      for each row execute function protect_system_admin();
    `)
    await client.query(`alter table customers add column if not exists first_name text`)
    await client.query(`alter table customers add column if not exists middle_name text`)
    await client.query(`alter table customers add column if not exists last_name text`)
    await client.query(`
      with parsed as (
        select id, regexp_split_to_array(trim(name), '\\s+') as parts
        from customers
        where first_name is null or last_name is null
      )
      update customers c
      set first_name = parsed.parts[1],
          middle_name = case
            when array_length(parsed.parts, 1) > 2
              then array_to_string(parsed.parts[2:array_length(parsed.parts, 1) - 1], ' ')
            else null
          end,
          last_name = case
            when array_length(parsed.parts, 1) > 1
              then parsed.parts[array_length(parsed.parts, 1)]
            else ''
          end
      from parsed
      where c.id = parsed.id
    `)
    await client.query(`alter table customers alter column first_name set not null`)
    await client.query(`alter table customers alter column last_name set not null`)
    await client.query(
      `create index if not exists idx_customers_created_at_desc on customers (created_at desc)`
    )
    await client.query(`alter table users add column if not exists features jsonb not null default '[]'::jsonb`)
    await client.query(`
      update users
      set features = case
        when is_admin or team = 'Admin' then
          '["dashboard","customers","createCustomer","statusTracking","pmSuryaghar","documents","payments","users","inactiveCustomer"]'::jsonb
        when team = 'Office' then
          '["dashboard","customers","createCustomer","statusTracking","pmSuryaghar","documents"]'::jsonb
        when team in ('Account', 'Loan') then
          '["dashboard","customers","statusTracking","payments"]'::jsonb
        when team = 'Installation' then
          '["dashboard","customers","statusTracking","documents"]'::jsonb
        else
          '["dashboard","customers","createCustomer"]'::jsonb
      end
      where features = '[]'::jsonb
    `)
    await client.query(`
      update users
      set features = case
        when features ? 'photos' and not features ? 'documents'
          then (features - 'photos') || '["documents"]'::jsonb
        else features - 'photos'
      end
      where features ? 'photos'
    `)
    await client.query(`
      update users
      set features = (features - 'history') - 'notifications'
      where features ? 'history' or features ? 'notifications'
    `)
    try {
      await client.query(`alter type document_type add value if not exists 'Other'`)
    } catch (err) {
      if (!/already exists|duplicate/i.test(err.message)) throw err
    }

    await client.query(`
      create table if not exists teams (
        name team_name primary key,
        created_at timestamptz not null default now()
      )
    `)
    await client.query(`
      insert into teams (name)
      values ('Admin'), ('Installation'), ('Sales'), ('Office'), ('Account'), ('Loan')
      on conflict (name) do nothing
    `)
    await client.query(`
      update category_definitions
      set is_optional = true
      where category = 'finance'
    `)
    await client.query(`
      update stage_definitions
      set options = array['Pending','Approved','Rejected']
      where category = 'name_change' and sub_stage_key = 'application'
    `)
    await client.query(`
      update stage_definitions
      set options = array['Not Applicable','Request Submitted','Approved','Completed','Rejected']
      where category = 'finance' and sub_stage_key = 'bank_loan'
    `)
    await client.query(`
      update customer_categories
      set extra = extra || jsonb_build_object(
        'installment1_amount', extra->'amount_received',
        'installment1_date', extra->'received_date'
      )
      where category = 'finance'
        and extra ? 'amount_received'
        and not (extra ? 'installment1_amount')
    `)
    // 'On Hold' only exists on older databases; skip when the enum lacks it.
    await client.query(`
      do $$
      begin
        if exists (
          select 1 from pg_enum e
          join pg_type t on t.oid = e.enumtypid
          where t.typname = 'overall_status' and e.enumlabel = 'On Hold'
        ) then
          update customers
          set overall_status = 'In Progress'
          where overall_status::text = 'On Hold';
        end if;
      end $$
    `)
    await client.query(`
      do $$
      declare
        t text;
      begin
        foreach t in array array[
          'users',
          'teams',
          'user_category_permissions',
          'stage_definitions',
          'category_definitions',
          'customers',
          'customer_categories',
          'customer_sub_stages',
          'documents',
          'photos',
          'payments',
          'activity_log',
          'notifications'
        ]
        loop
          execute format('alter table if exists public.%I enable row level security', t);
          execute format('revoke all on table public.%I from anon, authenticated', t);
        end loop;
      end $$
    `)
    // Overall status now advances from any category, not just name change /
    // rooftop solar. Promote customers whose work already started elsewhere.
    await client.query(`
      update customers c
      set overall_status = 'In Progress',
          updated_at = now()
      where c.overall_status = 'New'
        and exists (
          select 1
          from customer_sub_stages css
          where css.customer_id = c.id
            and css.value in ('In Progress', 'Completed', 'Rejected',
                              'Request Submitted', 'Approved', 'Yes',
                              'Claimed', 'Disbursed')
        )
    `)
    console.log('Migration applied.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
