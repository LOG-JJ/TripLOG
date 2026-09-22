-- Read-only operator diagnostics. No itinerary bodies, booking references or tokens.
select * from public.triplog_sync_health;
select collaboration_version,count(*) from public.triplog_trips group by collaboration_version;
select jobname,schedule,active from cron.job where jobname like 'triplog-sync-%';
select j.jobname,r.status,r.start_time,r.end_time
from cron.job_run_details r join cron.job j using(jobid)
where j.jobname like 'triplog-sync-%' order by r.start_time desc limit 20;
select t.id,t.sync_revision,t.min_sync_cursor,t.archived_at,
  count(e.*) filter(where e.deleted_at is null) as active_entities,
  count(e.*) filter(where e.deleted_at is null and e.kind='note_update') as active_note_updates
from public.triplog_trips t left join public.triplog_entities e on e.trip_id=t.id
group by t.id order by t.updated_at desc limit 100;
