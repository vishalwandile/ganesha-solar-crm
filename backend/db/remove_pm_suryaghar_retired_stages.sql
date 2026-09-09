-- Retire two PM Suryaghar sub-stages for every customer, existing ones included:
--   bank_verification  (Bank Details Verification)
--   discom_inspection  (Inspection from DISCOM)
--
-- This deletes the saved values, so it is NOT reversible — take a backup first
-- (npm --prefix backend run backup:db).
--
-- Re-runnable: deletes nothing once the rows are gone.
-- Also included in `npm --prefix backend run db:migrate`; use this file when
-- running straight from the Supabase SQL editor.

-- Preview how many saved values will be deleted, and for whom:
-- select css.sub_stage_key, css.value, count(*)
-- from public.customer_sub_stages css
-- where css.category = 'pm_suryaghar'
--   and css.sub_stage_key in ('bank_verification', 'discom_inspection')
-- group by css.sub_stage_key, css.value
-- order by css.sub_stage_key, css.value;

begin;

-- Saved values must go first: customer_sub_stages FKs stage_definitions.
delete from public.customer_sub_stages
where category = 'pm_suryaghar'
  and sub_stage_key in ('bank_verification', 'discom_inspection');

delete from public.stage_definitions
where category = 'pm_suryaghar'
  and sub_stage_key in ('bank_verification', 'discom_inspection');

-- Close the gaps left in the step order (was 1,3,5,6).
update public.stage_definitions
set sort_order = case sub_stage_key
  when 'application' then 1
  when 'installation_uploaded' then 2
  when 'subsidy_request' then 3
  when 'subsidy' then 4
  else sort_order
end
where category = 'pm_suryaghar'
  and sub_stage_key in ('application', 'installation_uploaded', 'subsidy_request', 'subsidy');

commit;

-- Verify: expect exactly the 4 remaining steps in order 1..4.
-- select sub_stage_key, label, sort_order
-- from public.stage_definitions
-- where category = 'pm_suryaghar'
-- order by sort_order;
