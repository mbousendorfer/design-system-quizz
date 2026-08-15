-- Overview aggregates.
--
-- These two exist because a distinct count cannot be reassembled from other
-- aggregates: a player who ran on Monday and Tuesday is one player, not two, so
-- summing per-day player counts would be wrong. PostgREST also has aggregate
-- functions disabled on this project, which rules out doing it in the query string.
--
-- Everything else the stats page needs is already covered by question_stats,
-- component_stats, mode_stats, team_stats, confusion_matrix and
-- calibration_candidates.

create or replace view public.overview_stats
with (security_invoker = on)
as
select
  count(*)::integer as runs_played,
  count(distinct player_id)::integer as players,
  round(avg(score), 1) as average_score,
  coalesce(max(score), 0)::integer as best_score,
  count(*) filter (where score > 0)::integer as scoring_runs,
  min(finished_at) as first_run,
  max(finished_at) as last_run
from public.runs
where finished_at is not null;

create or replace view public.daily_stats
with (security_invoker = on)
as
select
  date_trunc('day', finished_at)::date as day,
  count(*)::integer as runs_played,
  count(distinct player_id)::integer as players,
  round(avg(score), 1) as average_score
from public.runs
where finished_at is not null
group by 1;
