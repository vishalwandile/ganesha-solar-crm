-- One-time data fix. Do NOT add this to db:migrate (that script is re-runnable
-- and would flip new "Completed" loans back to Approved).
--
-- Old meaning of Completed ≈ loan sanctioned / first money received.
-- New meaning: Approved = first installment; Completed = both installments done.
-- Only remap when the second installment is not recorded yet.

-- Preview
-- select c.name, css.value, cc.extra->>'installment2_amount' as inst2
-- from public.customer_sub_stages css
-- join public.customers c on c.id = css.customer_id
-- left join public.customer_categories cc
--   on cc.customer_id = css.customer_id and cc.category = 'finance'
-- where css.category = 'finance'
--   and css.sub_stage_key = 'bank_loan'
--   and css.value = 'Completed'
--   and coalesce((cc.extra->>'installment2_amount')::numeric, 0) = 0;

begin;

update public.customer_sub_stages css
set value = 'Approved',
    updated_at = now()
where css.category = 'finance'
  and css.sub_stage_key = 'bank_loan'
  and css.value = 'Completed'
  and exists (
    select 1
    from public.customer_categories cc
    where cc.customer_id = css.customer_id
      and cc.category = 'finance'
      and coalesce((cc.extra->>'installment2_amount')::numeric, 0) = 0
  );

commit;
