-- One-time data fix. Do NOT add this to db:migrate (that script is re-runnable
-- and would flip new "Completed" loans back to Approved).
--
-- Old meaning of Completed ≈ loan sanctioned / first money received.
-- New meaning: Approved = first installment; Completed = both installments done.

-- Preview
-- select customer_id, value, stage_date
-- from public.customer_sub_stages
-- where category = 'finance'
--   and sub_stage_key = 'bank_loan'
--   and value = 'Completed';

begin;

update public.customer_sub_stages
set value = 'Approved',
    updated_at = now()
where category = 'finance'
  and sub_stage_key = 'bank_loan'
  and value = 'Completed';

commit;
