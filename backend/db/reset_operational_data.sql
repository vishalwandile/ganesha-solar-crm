-- Ganesha Solar CRM — wipe operational data, keep master data and logins.
-- Safe to re-run. Does NOT drop tables, enums, RLS, or the admin user.
--
-- Kept:
--   teams
--   category_definitions
--   stage_definitions
--   users (including admin)
--   user_category_permissions
--
-- Deleted:
--   customers and every row that belongs to a customer
--   (documents, photos, payments, activity_log, notifications,
--    customer_categories, customer_sub_stages)
--
-- Run in the Supabase SQL editor, or:
--   psql "$DATABASE_URL" -f backend/db/reset_operational_data.sql
--
-- Storage objects in the ganesha_solar bucket are not deleted by this file.

begin;

-- Truncate customer-owned tables. CASCADE also clears tables that FK to customers.
truncate table
  public.notifications,
  public.activity_log,
  public.payments,
  public.documents,
  public.photos,
  public.customer_sub_stages,
  public.customer_categories,
  public.customers
restart identity cascade;

-- Restore master lookup rows if they were ever emptied.
insert into public.teams (name) values
  ('Admin'), ('Installation'), ('Sales'), ('Office'), ('Account'), ('Loan')
on conflict (name) do nothing;

insert into public.category_definitions (category, label, owner_team, is_optional, sort_order) values
  ('name_change',    'Name Change',    'Office',             true,  1),
  ('rooftop_solar',  'Rooftop Solar',  'Office',             false, 2),
  ('pm_suryaghar',   'PM Suryaghar',   'Office',             false, 3),
  ('finance',        'Finance',        'Account',            true,  4),
  ('installation',   'Installation',   'Installation',       false, 5),
  ('closure',        'Closure',        'Office',             false, 6)
on conflict (category) do update
set label = excluded.label,
    owner_team = excluded.owner_team,
    is_optional = excluded.is_optional,
    sort_order = excluded.sort_order;

insert into public.stage_definitions (category, sub_stage_key, label, sort_order, options) values
  ('name_change', 'doc_received',   'Document Received',    1, array['Pending','Completed']),
  ('name_change', 'app_submitted',  'Application Submitted',2, array['Pending','Completed']),
  ('name_change', 'demand',         'Demand',                3, array['Pending','Completed']),
  ('name_change', 'application',    'Application',           4, array['Pending','Approved','Rejected']),

  ('rooftop_solar', 'app_submitted','Application Submitted', 1, array['Pending','Completed']),

  ('pm_suryaghar', 'application',            'Application',                    1, array['Pending','Completed']),
  ('pm_suryaghar', 'installation_uploaded',  'Installation Details Uploaded',  2, array['Pending','Completed']),
  ('pm_suryaghar', 'subsidy_request',        'Subsidy Request',                3, array['Pending','Claimed']),
  ('pm_suryaghar', 'subsidy',                'Subsidy',                        4, array['Pending','Disbursed']),

  ('finance', 'bank_loan', 'Bank Loan', 1, array['Not Applicable','Request Submitted','Approved','Completed','Rejected']),

  ('installation', 'fabrication_material', 'Fabrication Material Dispatched', 1, array['No','Yes']),
  ('installation', 'fabrication_work',     'Fabrication Work',                2, array['Pending','Completed']),
  ('installation', 'panel_installation',   'Solar Panel Installation',        3, array['Pending','Completed']),
  ('installation', 'wiring',               'Wiring',                          4, array['Pending','Completed']),
  ('installation', 'release_order',        'Release Order',                   5, array['Pending','Completed']),
  ('installation', 'meter_installation',   'Meter Installation',              6, array['Pending','Completed']),

  ('closure', 'project_closed', 'Project Closed', 1, array['No','Yes'])
on conflict (category, sub_stage_key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    options = excluded.options;

-- Retired PM Suryaghar steps. Safe here because customer_sub_stages was truncated.
delete from public.stage_definitions
where category = 'pm_suryaghar'
  and sub_stage_key in ('bank_verification', 'discom_inspection');

-- Optional: keep only admin logins and drop other users.
-- Uncomment the two statements below if you also want a clean Users list.
-- delete from public.user_category_permissions
-- where user_id in (select id from public.users where is_admin = false);
-- delete from public.users where is_admin = false;

commit;

-- Quick check after run:
-- select 'customers' as tbl, count(*) from customers
-- union all select 'documents', count(*) from documents
-- union all select 'payments', count(*) from payments
-- union all select 'notifications', count(*) from notifications
-- union all select 'users', count(*) from users
-- union all select 'teams', count(*) from teams
-- union all select 'category_definitions', count(*) from category_definitions
-- union all select 'stage_definitions', count(*) from stage_definitions;
