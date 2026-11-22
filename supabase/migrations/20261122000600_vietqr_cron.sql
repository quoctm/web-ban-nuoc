begin;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('mat-nha-expire-vietqr', '* * * * *', 'select public.expire_vietqr_orders()');

commit;
