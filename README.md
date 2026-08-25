# DS Quiz

An internal game for learning the Agorapulse design system. A player picks a
name, plays five timed questions, gets an explanation after each one, and lands
on a leaderboard.

It is a **static site**, deployed to GitHub Pages. There is no server, and that
shapes everything below.

## What that costs, said plainly

The first version of this app kept the answer key on a server and stamped the
clock there, so neither could be reached from the browser. A static host cannot
offer that. What replaced it:

- **The answer key is in the bundle**, because there is nothing else to ask. It
  is also in this repository, in `content/questions.json`.
- **The clock belongs to the player.** The timer is a rule of the game now, not
  something enforced.
- **The leaderboard is open to writing.** `public_scores` accepts an insert from
  anyone with the publishable key, which is everyone. The check constraints keep
  the board readable; they are not a security boundary.

For an internal quiz played by people who want to learn, that is a fair trade.
It would not be for anything scored competitively.

## Running it locally

```bash
npm install
npm run dev
```

No environment variables are needed to play. The leaderboard is the only part
that talks to anything, and it degrades to a message if it has no credentials.

## The question bank

Questions are **files**, not database rows: `content/questions.json`, reviewed in
pull requests, baked into the build. Only `"status": "published"` questions are
drawn; drafts sit in the same file as work in progress.

`npm run questions:export` re-reads them from Supabase — useful once, to get the
existing bank out. It needs `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in
`.env.local` and is not part of the build.

Writing a good question is its own document: [docs/WRITING-QUESTIONS.md](docs/WRITING-QUESTIONS.md).

## The leaderboard

One table, `public_scores`, written directly from the browser with the
**publishable** key. What an anonymous visitor may do is decided by the row level
security policies in
`supabase/migrations/20260825120000_public_leaderboard.sql`: insert a score, read
the board, nothing else. No update, no delete.

The secret key must never appear in a `NEXT_PUBLIC_` variable. It bypasses row
level security, and everything `NEXT_PUBLIC_` is inlined into the bundle.

To enable it, set two **repository variables** (Settings → Secrets and variables
→ Actions → Variables):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key |

Without them the game plays fine and the leaderboard says it is off.

## Deploying

Push to `main`. `.github/workflows/pages.yml` typechecks, lints, tests, builds
and deploys. Enable it once in **Settings → Pages → Source → GitHub Actions**.

Two things that will silently break the site if they are ever removed:

- `touch out/.nojekyll`, because Pages runs Jekyll by default and Jekyll skips
  directories beginning with an underscore — including Next's `_next`, which is
  all the JavaScript and CSS;
- `NEXT_PUBLIC_BASE_PATH`, because a project site is served from `/<repo>` and
  not from the domain root. Next rewrites `<Link>` and its own assets, but a URL
  you assemble yourself is untouched. Everything that builds one goes through
  `assetPath()` in `lib/base-path.ts`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Static export into `out/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Schema, sanitiser, scoring, question drawing, CSS leak checks |
| `npm run ds:catalog` | Regenerates the component catalog from design-specs and Storybook |
| `npm run ds:css` | Vendors the design system stylesheets, with every class renamed |
| `npm run questions:export` | Pulls the question bank and screenshots out of Supabase |
| `npm run db:sql` | Bundles the migrations for the Supabase SQL editor |

## Keeping up with the design system

`npm run ds:catalog` reads `~/code/design-system/design-specs/`, overridable with
`DS_SPECS_DIR`. The design system repository is only ever read, never written to.
The catalog is the union of the specs and the live Storybook index, so a
component whose story was renamed still links correctly and one with no story
gets no link rather than a wrong one.

`npm run ds:css` vendors the stylesheets at pinned versions — never `@latest`,
because a silent upgrade would change what a published question renders.

**Re-running `ds:css` invalidates every live render.** It salts all six hundred
class names, so markup compiled against the old sheet renders as unstyled HTML.
Each render stores the checksum it was built against; after regenerating, rebuild
the affected questions from their recipes.

## Things worth knowing before changing anything

**Components are rendered live, and the markup is renamed.** A live render is
stored as a recipe — component, modifiers, label — plus the markup it compiles
to. The vendored stylesheet renames every class, custom property, animation and
element selector, because `ap-button ghost` would otherwise spell out both the
component and the variant to anyone with an inspector. This is obfuscation, not
security, and `content/ds-classmap.json` — the map that undoes it — is in this
repository.

`spot-the-drift` stays on screenshots. The drift *is* the markup, and no rename
hides an inline `style` attribute.

**The plate is white in both themes.** Every examined component sits on it, live
render and screenshot alike. The design system is authored against white, and a
tinted ground would make a white component read off-white on the one screen where
judging that is the exercise.

**The visual system is written down.** `.interface-design/system.md` records the
palette, the layout rules and — more usefully — the mistakes this codebase has
already made once each.
