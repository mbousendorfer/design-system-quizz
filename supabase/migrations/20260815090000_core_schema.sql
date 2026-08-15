-- Core schema for the DS Quiz.
--
-- Runs are wider than questions on two axes: a run can be played in `mixed` mode
-- and at `progressive` difficulty, neither of which a question can ever be. Hence
-- two pairs of enums rather than one.

create type quiz_mode as enum (
  'name-that-component',
  'which-variant',
  'spot-the-drift',
  'which-component'
);

create type run_mode as enum (
  'name-that-component',
  'which-variant',
  'spot-the-drift',
  'which-component',
  'mixed'
);

create type quiz_difficulty as enum ('easy', 'medium', 'hard');

create type run_difficulty as enum ('easy', 'medium', 'hard', 'progressive');

create type question_status as enum ('draft', 'published', 'archived');

create type player_team as enum ('product', 'engineering', 'design', 'other');

-- ---------------------------------------------------------------------------

create table public.players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null check (char_length(btrim(pseudo)) between 1 and 32),
  team player_team not null default 'other',
  created_at timestamptz not null default now()
);

-- One player per name, case-insensitively: "Sam" and "sam" are the same person.
create unique index players_pseudo_key on public.players (lower(btrim(pseudo)));

-- ---------------------------------------------------------------------------

-- Subqueries are not allowed inside CHECK constraints, so the "the correct answer
-- points at an option that exists" rule goes through an immutable function.
create function public.jsonb_options_contain(options jsonb, option_id text)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements(options) as option
    where option ->> 'id' = option_id
  )
$$;

create table public.questions (
  -- Stable across versions: every version of a question shares this id, which is
  -- what `answers` references, so statistics survive re-versioning.
  id uuid not null default gen_random_uuid(),
  version integer not null default 1 check (version > 0),
  mode quiz_mode not null,
  difficulty quiz_difficulty not null,
  status question_status not null default 'draft',
  -- The component the question is about. The aggregation axis for the stats.
  component text not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option_id text,
  explanation text not null default '',
  doc_url text,
  image_key text,
  -- Overrides the level default when set.
  timer_seconds integer check (timer_seconds between 5 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, version)
);

-- Drafts may be incomplete. Publishing may not: these are the blocking rules from
-- the brief, enforced at the storage layer as well as in zod.
alter table public.questions
  add constraint questions_published_is_complete check (
    status <> 'published'
    or (
      char_length(btrim(prompt)) > 0
      and char_length(btrim(explanation)) >= 20
      and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) between 2 and 6
      and correct_option_id is not null
      and public.jsonb_options_contain(options, correct_option_id)
      -- `name-that-component` is the only mode that needs its own screenshot;
      -- the other image mode carries its images on the options instead.
      and (mode <> 'name-that-component' or image_key is not null)
    )
  );

-- At most one version of a question is live at a time; the rest are archived.
create unique index questions_single_live on public.questions (id)
  where status <> 'archived';

create index questions_pool on public.questions (mode, difficulty)
  where status = 'published';

create index questions_component on public.questions (component);

-- ---------------------------------------------------------------------------

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  mode run_mode not null,
  difficulty run_difficulty not null,
  score integer not null default 0 check (score >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index runs_player on public.runs (player_id, started_at desc);

create index runs_leaderboard on public.runs (difficulty, score desc)
  where finished_at is not null;

-- ---------------------------------------------------------------------------

-- The questions drawn for a run, written at draw time.
--
-- This table is what makes the anti-cheat and the anti-repetition work:
--   * `served_at` is the server's own clock reading, so the answer timing cannot
--     be forged by a client that simply waits before posting.
--   * a question that was served counts as seen even if the run was abandoned,
--     so quitting a run does not recycle its questions.
create table public.run_items (
  run_id uuid not null references public.runs (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  question_id uuid not null,
  question_version integer not null,
  -- Frozen at draw time so that re-calibrating a question mid-run cannot move the
  -- goalposts under the player.
  timer_seconds integer not null check (timer_seconds between 5 and 120),
  served_at timestamptz,
  primary key (run_id, position),
  foreign key (question_id, question_version)
    references public.questions (id, version)
);

create index run_items_question on public.run_items (question_id);

-- ---------------------------------------------------------------------------

-- `component`, `mode` and `difficulty` are denormalised on purpose: the stats stay
-- true even after a question is archived, re-versioned or re-calibrated to another
-- level. `points` is stored for the same reason — changing the scoring formula
-- must not rewrite the history of the leaderboard.
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  position smallint not null,
  question_id uuid not null,
  question_version integer not null,
  component text not null,
  mode quiz_mode not null,
  difficulty quiz_difficulty not null,
  -- Null means the timer ran out without a choice.
  chosen_option_id text,
  correct boolean not null,
  time_ms integer not null check (time_ms >= 0),
  points integer not null default 0 check (points >= 0),
  answered_at timestamptz not null default now(),
  unique (run_id, position),
  foreign key (run_id, position)
    references public.run_items (run_id, position) on delete cascade,
  -- A timeout can never be correct.
  constraint answers_timeout_is_never_correct
    check (chosen_option_id is not null or correct = false)
);

create index answers_question on public.answers (question_id, question_version);

create index answers_component on public.answers (component);

create index answers_stats on public.answers (mode, difficulty, answered_at);
