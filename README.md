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

Applies the migrations to an in-memory Postgres (PGlite) and asserts 45 rules:
the versioning trigger, the single-live-version index, the publish-time
constraints, the stats views, that the bulk import is genuinely all-or-nothing, and
that Postgres and TypeScript still agree on the list of modes — that last one reads
`MODES` from the TypeScript source and interrogates `pg_enum`, so adding a sixth mode
fails here until the SQL follows.
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
| `npm run ds:catalog` | Regenerates `content/ds-catalog.json` from the design system and the live Storybook |
| `npm run ds:css` | Vendors the design system stylesheets, with every class renamed |
| `npm run ds:descriptions` | Extracts redacted component descriptions from the design guidelines |
| `npm run ds:recompile` | Rebuilds live renders after `ds:css` reassigns the class names |
| `npm run db:drafts` | Generates a draft question per usable description |
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

The catalog is the union of two sources. Most components come from `design-specs/`;
seven come from the Storybook alone, which documents them where the specs never did.
Documentation links are resolved against the live story index, so a component whose
story was renamed still links correctly, and one with no story gets no link at all
rather than a wrong one.

`npm run ds:css` vendors the stylesheets. It reads `DS_THEME_VERSION` and
`DS_SYMBOL_VERSION`, both pinned in the script — never `@latest`, because a silent
upgrade would change what a published question renders and quietly invalidate its
answer.

**Always follow `ds:css` with `npm run ds:recompile`.** The salt reassigns every
class name, so markup compiled against the previous sheet renders as unstyled HTML —
right structure, no design system, and nothing anywhere to say why. Each render
stores the checksum it was built against and its recipe, so `ds:recompile` finds the
stale ones and rebuilds them in place, without cutting versions: the question did not
change, only the stylesheet did, so the statistics stay attached.

`npm run ds:descriptions` reads the design-guidelines plugin, defaulting to
`~/sources/claude-marketplace/plugins/design/design-guidelines/references/components`
and overridable with `DS_GUIDELINES_DIR`. Its output is committed, so nobody needs
that checkout to build or to write questions — only to regenerate.

## Things worth knowing before changing anything

**Components are rendered live, and the markup is renamed.** A live render is
stored as a recipe — component, modifiers, label — plus the markup it compiles to,
and only the markup travels. The vendored stylesheet renames every class and custom
property, because `ap-button ghost` would otherwise spell out both the component and
the variant to anyone with an inspector. This is obfuscation, not security: a
structural diff against the public CDN file recovers the map. It raises cheating
from five seconds and no skill to an afternoon of scripting, which is the right
amount of defence for an internal quiz.

`spot-the-drift` stays on screenshots. The drift *is* the markup, and no rename
hides an inline `style` attribute.

**The answer key never reaches the browser — but it is in this repository.**
At runtime, questions are served through the `questions_public` view, which does
not carry `correct_option_id` or `explanation` at all, and `buildPlayerQuestion`
also drops the component name on the two modes where naming it is the answer.
Answers are judged in `/api/runs/[runId]/answers` and nowhere else.

That is a statement about the running app, not about this repository. Since the
repository is public, three committed files are worth knowing about before you
rely on the quiz being hard to cheat:

- `content/questions.json` carries `correctOptionId` and the explanation for every
  published question at the time it was exported;
- `content/ds-classmap.json` is the map `ds:css` uses to rename classes, so anyone
  holding it can undo the obfuscation in seconds rather than in an afternoon;
- `content/ds-catalog.json` and `content/component-descriptions.json` are derived
  from Agorapulse's design-specs and guidelines.

None of this breaks the server-side guarantees — the clock, the versioning and the
judging all still hold. It means the honour system is doing more work than the
architecture is.

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
