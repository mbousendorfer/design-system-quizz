-- Read models: the pool the game draws from, and the seven stats views.
--
-- Every view is `security_invoker`, so it enforces the caller's row level security
-- rather than the view owner's. Combined with the deny-all policies in the next
-- migration, that means a view is not a way around the tables.

-- ---------------------------------------------------------------------------
-- The pool the game is allowed to see
-- ---------------------------------------------------------------------------

-- Defence in depth for the anti-cheat rule. `correct_option_id` and `explanation`
-- are simply absent here, so a mistake in a server query cannot leak them — an
-- explanation reading "a Badge is for counts…" gives the answer away just as
-- plainly as the option id does.
--
-- `component` is nulled on the two modes where naming the component *is* the
-- answer, and kept on the two where it is part of the question.
create view public.questions_public
with (security_invoker = on)
as
select
  id,
  version,
  mode,
  difficulty,
  case
    when mode in ('name-that-component', 'which-component') then null
    else component
  end as component,
  prompt,
  options,
  doc_url,
  image_key,
  timer_seconds
from public.questions
where status = 'published';

-- ---------------------------------------------------------------------------
-- 2. Per question
-- ---------------------------------------------------------------------------

create view public.question_stats
with (security_invoker = on)
as
select
  question_id,
  question_version,
  count(*)::integer as plays,
  count(*) filter (where correct)::integer as correct_count,
  round(count(*) filter (where correct)::numeric / count(*), 4) as success_rate,
  percentile_cont(0.5) within group (order by time_ms)::integer as median_time_ms
from public.answers
group by question_id, question_version;

-- ---------------------------------------------------------------------------
-- 3. Confusion matrix
-- ---------------------------------------------------------------------------

-- Only meaningful on the modes whose options name components: "when the answer was
-- Badge, players picked Tag 60% of the time" is the single most useful signal for
-- knowing which parts of the design system are blurry.
create view public.confusion_matrix
with (security_invoker = on)
as
select
  answers.component as expected_component,
  chosen.component as chosen_component,
  count(*)::integer as occurrences
from public.answers
join public.questions
  on questions.id = answers.question_id
  and questions.version = answers.question_version
cross join lateral (
  select option ->> 'component' as component
  from jsonb_array_elements(questions.options) as option
  where option ->> 'id' = answers.chosen_option_id
) as chosen
where answers.correct = false
  and answers.chosen_option_id is not null
  and answers.mode in ('name-that-component', 'which-component')
  and chosen.component is not null
group by answers.component, chosen.component;

-- ---------------------------------------------------------------------------
-- 4. Per component
-- ---------------------------------------------------------------------------

create view public.component_stats
with (security_invoker = on)
as
select
  component,
  count(*)::integer as plays,
  count(*) filter (where correct)::integer as correct_count,
  round(count(*) filter (where correct)::numeric / count(*), 4) as success_rate,
  count(distinct question_id)::integer as question_count
from public.answers
group by component;

-- ---------------------------------------------------------------------------
-- 5. Per mode
-- ---------------------------------------------------------------------------

create view public.mode_stats
with (security_invoker = on)
as
select
  mode,
  difficulty,
  count(*)::integer as plays,
  count(*) filter (where correct)::integer as correct_count,
  round(count(*) filter (where correct)::numeric / count(*), 4) as success_rate,
  percentile_cont(0.5) within group (order by time_ms)::integer as median_time_ms
from public.answers
group by mode, difficulty;

-- ---------------------------------------------------------------------------
-- 6. Calibration
-- ---------------------------------------------------------------------------

-- Declared difficulty against measured difficulty. Hidden below ten plays, where
-- a success rate means nothing.
--
-- The brief asks for hard-above-85% and easy-below-55%; medium is included in both
-- directions on the same thresholds, since a medium question nobody misses is just
-- as mislabelled as a hard one.
create view public.calibration_candidates
with (security_invoker = on)
as
select
  questions.id,
  questions.version,
  questions.mode,
  questions.component,
  questions.prompt,
  questions.difficulty as declared_difficulty,
  question_stats.plays,
  question_stats.success_rate,
  case
    when questions.difficulty = 'hard' then 'medium'
    when questions.difficulty = 'medium' and question_stats.success_rate > 0.85 then 'easy'
    when questions.difficulty = 'medium' and question_stats.success_rate < 0.55 then 'hard'
    else 'medium'
  end::quiz_difficulty as suggested_difficulty
from public.questions
join public.question_stats
  on question_stats.question_id = questions.id
  and question_stats.question_version = questions.version
where question_stats.plays >= 10
  and (
    (questions.difficulty = 'hard' and question_stats.success_rate > 0.85)
    or (questions.difficulty = 'easy' and question_stats.success_rate < 0.55)
    or (questions.difficulty = 'medium'
        and (question_stats.success_rate > 0.85 or question_stats.success_rate < 0.55))
  );

-- ---------------------------------------------------------------------------
-- 7. Per team
-- ---------------------------------------------------------------------------

create view public.team_stats
with (security_invoker = on)
as
select
  players.team,
  answers.difficulty,
  count(*)::integer as plays,
  count(*) filter (where answers.correct)::integer as correct_count,
  round(count(*) filter (where answers.correct)::numeric / count(*), 4) as success_rate,
  count(distinct players.id)::integer as player_count
from public.answers
join public.runs on runs.id = answers.run_id
join public.players on players.id = runs.player_id
group by players.team, answers.difficulty;

-- ---------------------------------------------------------------------------
-- Leaderboard
-- ---------------------------------------------------------------------------

-- Ranked per level, not globally: the score multiplier alone would not stop
-- somebody from camping the top of the table by grinding easy runs.
create view public.leaderboard_by_difficulty
with (security_invoker = on)
as
select
  runs.difficulty,
  players.id as player_id,
  players.pseudo,
  players.team,
  max(runs.score)::integer as best_score,
  count(*)::integer as runs_played,
  max(runs.finished_at) as last_played,
  rank() over (
    partition by runs.difficulty
    order by max(runs.score) desc, min(runs.finished_at) asc
  )::integer as position
from public.runs
join public.players on players.id = runs.player_id
where runs.finished_at is not null
group by runs.difficulty, players.id, players.pseudo, players.team;

-- ---------------------------------------------------------------------------
-- 1. Overview
-- ---------------------------------------------------------------------------

create view public.run_stats
with (security_invoker = on)
as
select
  date_trunc('day', runs.finished_at) as day,
  runs.mode,
  runs.difficulty,
  count(*)::integer as runs_played,
  count(distinct runs.player_id)::integer as players,
  round(avg(runs.score), 1) as average_score,
  max(runs.score)::integer as best_score
from public.runs
where runs.finished_at is not null
group by date_trunc('day', runs.finished_at), runs.mode, runs.difficulty;
