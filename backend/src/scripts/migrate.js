import pg from 'pg'
import 'dotenv/config'

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
    await client.query(`alter table customers add column if not exists is_active boolean not null default true`)
    await client.query(`alter table users add column if not exists is_active boolean not null default true`)
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
          '["dashboard","customers","createCustomer","statusTracking","pmSuryaghar","documents","payments","photos","history","notifications","users","inactiveCustomer"]'::jsonb
        when team = 'Office' then
          '["dashboard","customers","createCustomer","statusTracking","pmSuryaghar","documents","photos","history","notifications"]'::jsonb
        when team in ('Account', 'Loan') then
          '["dashboard","customers","statusTracking","payments","notifications"]'::jsonb
        when team = 'Installation' then
          '["dashboard","customers","statusTracking","photos","notifications"]'::jsonb
        else
          '["dashboard","customers","createCustomer","notifications"]'::jsonb
      end
      where features = '[]'::jsonb
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
      update customers
      set overall_status = 'In Progress'
      where overall_status = 'On Hold'
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
