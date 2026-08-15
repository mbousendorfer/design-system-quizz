-- A real column for the case-insensitive pseudo lookup.
--
-- The unique index on `lower(btrim(pseudo))` enforces one player per name, but
-- PostgREST can only filter on columns, not on index expressions. Matching with
-- `ilike` instead would be worse than it looks: `%` and `_` are wildcards there,
-- so a player called `sam_` would silently match `sam1`.
--
-- A stored generated column gives the API something to filter and upsert on, with
-- the normalisation still owned by the database.

alter table public.players
  add column pseudo_key text generated always as (lower(btrim(pseudo))) stored;

drop index if exists players_pseudo_key;

create unique index players_pseudo_key on public.players (pseudo_key);
