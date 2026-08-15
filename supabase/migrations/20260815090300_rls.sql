-- Row level security.
--
-- Deliberately stricter than "public read on published questions": no browser-side
-- key gets to read anything at all. Every read and every write goes through server
-- code holding the service key, which bypasses RLS.
--
-- The reasoning is that a filter you do not need is a filter you cannot get wrong.
-- There is no anon-key query path to audit, and `questions_public` exists as a
-- second line of defence for server code rather than as a client-facing surface.

alter table public.players enable row level security;
alter table public.questions enable row level security;
alter table public.runs enable row level security;
alter table public.run_items enable row level security;
alter table public.answers enable row level security;

-- No policies are created on purpose. With RLS enabled and no policy attached,
-- every non-superuser role that is not the table owner is denied every row.

-- Belt as well as braces: take the table grants away too, so a future policy added
-- by accident still does not open a client-side read path.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- `save_question_version` writes questions; only server code may call it.
revoke all on function public.save_question_version(jsonb) from anon, authenticated;

-- Stop the default grants from coming back for objects created later.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
