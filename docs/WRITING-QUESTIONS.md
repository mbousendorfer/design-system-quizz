# Writing a good question

The quiz is only worth playing if people learn something from being wrong. A
question that is merely hard teaches nothing; a question that is hard *for the
right reason* teaches the distinction the design system actually makes.

## The one rule

**Write the explanation first.** If you cannot say in two sentences why the right
answer is right and why the most tempting wrong answer is wrong, there is no
question there yet — only trivia.

The explanation is shown after every answer, right or wrong. It is the part that
does the teaching, and it is the only part every single player reads.

A good explanation:

- names the distinction, not just the answer — "Status carries a state the system
  decided, Tag carries one the user put there" beats "the answer is Status";
- says why the runner-up is wrong, because that is the mistake people made;
- points at something checkable — an input the component exposes, a modifier it
  ships, a rule in `patterns/conventions.md`.

A bad explanation restates the question. "This is a Badge because it is a badge."

## Per mode

### Name that component

A screenshot of one component, isolated. Pick its name.

- Crop tightly. Surrounding UI turns a recognition question into a context puzzle.
- The giveaway should be a real visual property, not an accident of the screenshot.
  "Status ships with a dot by default and has a `no-dot` modifier to remove it" is
  a fact about the component; "the screenshot happens to be green" is not.
- Distractors have to be plausible at a glance. The **Suggest distractors** button
  pulls from the curated confusable groups first, which is where the good ones are.

### Right variant

A situation in words, then several screenshots of variants of the same component.

- The situation must decide the answer on its own. If two variants would both be
  defensible, the question is broken — no explanation can rescue it.
- Lean on meaning rather than looks. The design system picks colour families by
  intent: `main`/orange for primary actions, `feature-lock`/purple for gated
  features, `mermaid` for AI surfaces only. Those rules make excellent questions
  because getting them wrong has real consequences.
- Keep every screenshot identical except the variant. A different label or size
  between options gives the answer away for the wrong reason.

### Spot the drift

Two screenshots, one following the design system and one that drifted.

- Take the drift from something real. `patterns/conventions.md` documents the four
  that actually happen: hardcoded colours with BEM modifiers, an extra wrapper
  around an implicit child, a component rebuilt in raw CSS, and reaching for a
  primitive that already exists.
- One drift per question. Two makes the explanation vague.
- The two screenshots should be near-identical. If the wrong one is obviously
  uglier, nobody learns to spot the subtle version in a real pull request.

### Which component?

A product scenario in words, no screenshot at all.

- Write it as a real requirement, the way it would arrive in a ticket: "must stay
  on the page, carry a heading, and offer an Upgrade button". Each clause should
  rule something out.
- This is the mode where the intent table earns its keep. `design-specs/README.md`
  maps 144 phrasings onto components — "toast", "callout", "kebab menu" — and those
  are exactly the words people search for and fail to find.
- The best distractors are components that genuinely almost fit. Infobox versus
  Notification is a good question because both are inline messages and only one
  takes a title and a button.

### Name it from the description

How the design system describes a component, with its name taken out. The player
names it.

- **Fill from the guidelines** offers drafts taken from the design-guideline files,
  with every component name redacted. They are drafts, not prompts: the redaction
  replaces names with "this component", so "keep to ≤6 tabs" comes out as "keep to
  ≤6 this component". Read it back as a question and rewrite the rough edges.
- The test that matters: **does the description point at exactly one component?**
  "Turn a setting on or off" fits Toggle, Slide Toggle and Checkbox equally, so it
  is a broken question however true it is. The picker flags the ones that are too
  short to be unique, but only you can judge the rest.
- Prefer the **Usage** tier over **Anatomy** when both are offered. Usage describes
  intent and survives a redesign; Anatomy rewards memorising a number like "max
  180px" that will change.
- Distinctions the guidelines make explicitly are the best material here — Badge
  versus Counter versus Status versus Tag is four components that all look like a
  small pill and mean four different things.

## Choosing a level

`easy`, `medium` and `hard` set the number of options, the timer and the score
multiplier. Your call at writing time:

| Level | Options | Timer | What it should feel like |
| --- | --- | --- | --- |
| `easy` | 4 | 25s | Common components, distractors from other categories |
| `medium` | 5 | 20s | Same family, close variants |
| `hard` | 6 | 15s | Components that really do look alike |

**You will be wrong about this, and that is fine.** The stats page shows the
declared level next to the measured success rate, and the **Calibration** tab lists
every question where the two disagree — a `hard` nobody misses, an `easy` most
people fail — once it has at least ten plays. Below ten, a success rate is noise;
above it, trust the measurement over your instinct.

## Live renders instead of screenshots

For `which-variant`, you rarely need screenshots at all. Pick the component, tick
the variants worth comparing, and **Make N options from these** builds one option
per variant, rendered from the real design system stylesheet. They stay correct when
the design system changes, and there is nothing to re-capture.

The options are deliberately identical apart from the one modifier that differs. A
question where the variants also differ in size or label is asking something else.

`spot-the-drift` still needs screenshots: the whole question is about markup, and
markup rendered live is markup a player can read.

## Screenshots

Upload through the question form. The file is renamed to an opaque id on the way
in, so you can drop `badge-orange-wrong.png` without the filename handing the
answer to anyone reading the network tab.

PNG, JPEG or WebP, up to 2 MB. Crop to the component plus a little breathing room.
Take them at a consistent zoom — a player comparing two screenshots at different
scales is answering a different question than the one you asked.

## Writing in bulk

Thirty questions in a spreadsheet is faster than thirty passes through the form.
**Bulk import** takes a CSV or JSON paste, shows you every row with its errors
before writing anything, and refuses the whole batch if any row is bad. Upload the
screenshots first through a question form, then reference them by their key.

Duplicating an existing question is the other accelerator, and the right one for a
series of variants on the same component: everything is already filled in, and the
copy lands as a draft.

## Before publishing

The form refuses to publish until:

- exactly one option is marked correct;
- the option count fits the mode;
- the explanation is there and is a real sentence;
- a screenshot exists where the mode needs one;
- every component named — the answer and every distractor — exists in the design
  system catalog.

That last one is why the component field is a combobox and not a text box. A
question naming a component that does not exist can never be right, and finding
that out weeks later, from the stats, is expensive.
