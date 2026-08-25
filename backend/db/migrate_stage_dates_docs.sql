-- Incremental updates for existing Supabase DBs (safe to re-run).
alter table customer_sub_stages add column if not exists stage_date date;

alter table documents add column if not exists custom_name text;
alter table customers add column if not exists is_active boolean not null default true;
alter table users add column if not exists is_active boolean not null default true;
alter table customers add column if not exists first_name text;
alter table customers add column if not exists middle_name text;
alter table customers add column if not exists last_name text;

with parsed as (
  select id, regexp_split_to_array(trim(name), '\s+') as parts
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
where c.id = parsed.id;

alter table customers alter column first_name set not null;
alter table customers alter column last_name set not null;
create index if not exists idx_customers_created_at_desc on customers (created_at desc);

do $$
begin
  alter type document_type add value if not exists 'Other';
exception
  when duplicate_object then null;
end $$;

create table if not exists teams (
  name team_name primary key,
  created_at timestamptz not null default now()
);

insert into teams (name)
values ('Admin'), ('Installation'), ('Sales'), ('Office'), ('Account'), ('Loan')
on conflict (name) do nothing;

update category_definitions set is_optional = true where category = 'finance';
update customers set overall_status = 'In Progress' where overall_status = 'On Hold';

alter table users add column if not exists features jsonb not null default '[]'::jsonb;
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
where features = '[]'::jsonb;
