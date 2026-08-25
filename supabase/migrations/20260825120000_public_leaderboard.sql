-- A leaderboard a static site can write to.
--
-- Everything else in this schema is reachable only through server code holding
-- the secret key. That was the right shape while there was a server. On GitHub
-- Pages there is none, so the browser has to write its own score — which means
-- one table, reachable with the publishable key, whose row level security says
-- exactly what an anonymous visitor may do and nothing more.
--
-- ## What this deliberately does not do
--
-- It does not touch `runs`, `answers` or `players`. Those carry per-answer
-- timings and the question ids they were drawn from; opening them to `anon`
-- would hand out the shape of the question bank and every player's history to
-- get one number on a page. This table holds the finished score and nothing
-- that could reconstruct a run.
--
-- ## What an anonymous visitor can do
--
-- Insert a score, and read the board. Not update, not delete: a leaderboard
-- where a row can be edited after the fact is not a record of anything.
--
-- ## What stops nonsense
--
-- The check constraints below, and nothing else. A determined person can post a
-- score they did not earn — there is no server left to prove otherwise, and the
-- answers are in the public repository anyway. The constraints keep the board
-- readable (no negative scores, no 900-question runs, no essay in the name
-- field); they are not a security boundary and should not be described as one.

create table if not exists public.public_scores (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null check (char_length(btrim(pseudo)) between 1 and 32),
  team text not null check (team in ('product', 'engineering', 'design', 'other')),
  mode text not null,
  difficulty text not null,
  score integer not null check (score between 0 and 5000),
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions between 1 and 20),
  created_at timestamptz not null default now(),
  constraint public_scores_count_fits check (correct_count <= total_questions)
);

-- The board is read by level and ordered by score, and pruned by date for the
-- "last 7 days" filter.
create index if not exists public_scores_board
  on public.public_scores (difficulty, score desc, created_at desc);

alter table public.public_scores enable row level security;

drop policy if exists public_scores_insert on public.public_scores;
create policy public_scores_insert on public.public_scores
  for insert to anon, authenticated
  with check (true);

drop policy if exists public_scores_select on public.public_scores;
create policy public_scores_select on public.public_scores
  for select to anon, authenticated
  using (true);

-- Insert and select only. No update, no delete, and no policy granting them.
grant select, insert on public.public_scores to anon, authenticated;
