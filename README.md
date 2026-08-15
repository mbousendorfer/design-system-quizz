# DS Quiz

An internal game for learning the Agorapulse design system. A player picks a name,
plays five timed questions, gets an explanation after each one, and lands on a
leaderboard. A designer writes the questions in `/admin` and reads, in
`/admin/stats`, which components people actually confuse.

The interface is deliberately neutral shadcn/ui rather than Agorapulse-branded: the
UI being judged inside the questions is Agorapulse UI, so the chrome around it has
to look like something else. In `spot-the-drift` especially, an orange Agorapulse
frame around an orange Agorapulse screenshot would make the question unreadable.

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill it in, see below
npm run dev
```

## Environment variables

Four, all server-side. There is deliberately no `NEXT_PUBLIC_SUPABASE_*`: the
browser never talks to Supabase, so there is no anon key to ship and no
client-side query path to audit.

| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project settings → API |
| `SUPABASE_SECRET_KEY` | Same page, **API keys**. The `sb_secret_…` one. The `sb_publishable_…` key cannot bypass row level security and will read nothing here. |
| `ADMIN_PASSWORD` | Your call. The single password guarding `/admin`. |
| `ADMIN_SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Rotating it signs everyone out. |

On Vercel, set the same four in **Project settings → Environment Variables**, for
Production and Preview.

## Database

Migrations live in `supabase/migrations/`. There are two ways to apply them.

### The Supabase CLI (what you want from now on)

```bash
npm install -D supabase
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**One-time catch on this project.** The first migrations were applied by hand
through the SQL editor, so Supabase's own migration ledger does not know about
them and `db push` would try to re-run them. Tell it they are already applied,
once, before the first push:

```bash
npx supabase migration repair --status applied 20260815090000 20260815090100 \
  20260815090200 20260815090300 20260815090400 20260815100000 20260815110000 \
  20260815120000
```

After that, `db push` is the only thing you need.

### By hand

`npm run db:sql` concatenates every migration into `supabase/bundle.sql`, wrapped
in a transaction, ready to paste into the SQL editor. Useful for a fresh project;
it is what the CLI replaces.

### Verifying migrations without a database

```bash
npm run db:verify
```

Applies the migrations to an in-memory Postgres (PGlite) and asserts 41 rules:
the versioning trigger, the single-live-version index, the publish-time
constraints, the stats views, and that the bulk import is genuinely all-or-nothing.
It runs in a couple of seconds and needs no connection. The storage bucket and the
`anon` grants are the only parts it cannot cover, since they only exist on a real
Supabase instance.

## Seeding

```bash
npm run db:seed -- --dry-run   # validate and write the placeholder SVGs locally
npm run db:seed                # the above, plus upload and upsert
```

Twelve starter questions, three per mode, with placeholder screenshots.
`content/seed-shot-list.md` lists what each placeholder should eventually show.
Re-running updates in place rather than duplicating.

## Deploying to Vercel

1. Push the repository to GitHub.
2. Import it in Vercel. The defaults are right — Next.js, `npm run build`.
3. Add the four environment variables.
4. Deploy.

Nothing else to configure. The screenshots are served from Supabase Storage through
`/shots/[key]`, which sets a long immutable cache header, so the CDN answers almost
every image request without waking a function.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests: schema, sanitiser, scoring, question drawing |
| `npm run ds:catalog` | Regenerates `content/ds-catalog.json` from the design system |
| `npm run db:verify` | Migrations against an in-memory Postgres |
| `npm run db:sql` | Bundles the migrations for the SQL editor |
| `npm run db:seed` | Seeds the starter questions |
| `npm run smoke` | Plays a whole run against a running server, asserting the anti-cheat rules |
| `npm run questions:export` | Dumps published questions to `content/questions.json` |

## Keeping up with the design system

`npm run ds:catalog` reads `~/code/design-system/design-specs/` and regenerates the
component catalog. Run it whenever the design system gains or loses a component —
the catalog is what the admin combobox offers and what question validation checks
against, so a question can never name a component that does not exist.

Point it elsewhere with `DS_SPECS_DIR=/path/to/design-specs npm run ds:catalog`.
The design system repository is only ever read, never written to.

## Things worth knowing before changing anything

**The answer key never reaches the browser.** Questions are served through the
`questions_public` view, which does not carry `correct_option_id` or `explanation`
at all, and `buildPlayerQuestion` also drops the component name on the two modes
where naming it is the answer. Answers are judged in `/api/runs/[runId]/answers`
and nowhere else.

**The clock belongs to the server.** `run_items.served_at` is stamped when a
question is handed over, and elapsed time is measured from it. Re-serving keeps the
original stamp, so refreshing is not a second chance.

**Questions are versioned, not edited.** Once a question has been answered,
changing anything that was judged cuts a new version and archives the old one, so
past statistics keep describing what people were actually asked. The explanation
and the documentation link stay editable in place — fixing a typo should not cost
you ten plays' worth of data.

**There is no delete.** Every answer references the exact version of the question
it was given. Archive is the way out.

**Row level security denies everything.** No policies are attached, and the table
grants are revoked. Every read and write goes through server code holding the
secret key. A filter you do not need is a filter you cannot get wrong.
