-- Run after the collaboration migration and a successful staging smoke test.
-- These are application database jobs, not desktop/Codex automations.
create extension if not exists pg_cron;
select cron.schedule('triplog-sync-notifications','10 seconds','select public.triplog_flush_notifications(200)');
select cron.schedule('triplog-sync-retention','17 3 * * *','select public.triplog_retention()');

-- Daily retention also bounds the scheduler's own historical job metadata.
select cron.schedule('triplog-sync-job-history','37 3 * * *',
  $$delete from cron.job_run_details where jobid in
    (select jobid from cron.job where jobname like 'triplog-sync-%') and end_time<now()-interval '7 days'$$);
