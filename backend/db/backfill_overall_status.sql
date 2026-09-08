-- Overall status used to leave 'New' only when Name Change or Rooftop Solar was
-- saved, so customers whose work started in Installation, PM Suryaghar, Finance
-- or Closure stayed 'New'. This promotes them to 'In Progress'.
--
-- Re-runnable: a customer with no started sub-stage is left alone, and
-- 'In Progress' / 'Completed' customers are never downgraded.

-- Preview
-- select c.id, c.name, c.overall_status
-- from public.customers c
-- where c.overall_status = 'New'
--   and exists (
--     select 1 from public.customer_sub_stages css
--     where css.customer_id = c.id
--       and css.value in ('In Progress', 'Completed', 'Rejected',
--                         'Request Submitted', 'Approved', 'Yes',
--                         'Claimed', 'Disbursed')
--   );

begin;

update public.customers c
set overall_status = 'In Progress',
    updated_at = now()
where c.overall_status = 'New'
  and exists (
    select 1
    from public.customer_sub_stages css
    where css.customer_id = c.id
      and css.value in ('In Progress', 'Completed', 'Rejected',
                        'Request Submitted', 'Approved', 'Yes',
                        'Claimed', 'Disbursed')
  );

commit;
