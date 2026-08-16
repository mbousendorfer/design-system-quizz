# DS Quiz — the design system of the thing that quizzes you about a design system

## The idea

Every colour this product is *about* lives inside the questions. `main` orange,
`feature-lock` purple, the `mermaid` gradient — those are the answers. So the
chrome is a **gallery wall**: neutral by decision, not by default, and the
components are the works hung on it.

This is why the quiz must never be Agorapulse-branded, and the reason is
stronger than "avoid confusion": an orange frame around an orange specimen
destroys the comparison the player is being asked to make.

## Direction

Cool-neutral, quiet, technical. A field guide, not a game show. The one moment
allowed to be a payoff is the score at the end of a run.

## The signature: the plate

`components/game/render-box.tsx`. Every examined component sits on it.

- **Pure white in both themes.** The design system is authored against white. A
  tinted ground would make a white component read off-white on the one screen
  where judging exactly that is the exercise.
- **Same surface for every kind of content.** Live renders and screenshots share
  it. Giving them different grounds once meant the background sorted a mixed
  question's options into two groups before the player read anything.
- **Same geometry, always.** `aspect-[16/10]`, reserved before content exists.
- Hairline `--plate-edge`, `--radius-plate` (tighter than the card it sits in —
  a plate is a physical object inside a softer frame).

## Tokens

`app/globals.css`. Hue 255 at very low chroma throughout; never chroma 0, never
a second hue.

- **Elevation:** wall → card → popover, a few percent of lightness apart. You
  should not see a step; you should only read the stack.
- **Text, four levels:** `foreground`, `--text-secondary`, `--text-tertiary`,
  `muted-foreground`. Two levels is not a hierarchy.
- **Charts** are one ramp of the wall's own hue, not five unrelated colours.

## Depth

**Borders and surface shifts only.** No drop shadows anywhere. Borders live at
9–13% opacity so they disappear until you look for them.

## Type

- Body: the sans stack.
- **Every number a person compares or watches change is monospace and
  `tabular-nums`** — scores, ranks, timers, metric tiles, points. Proportional
  digits make a countdown jitter and make a row of tiles read as unrelated facts.
- Labels above figures: `text-xs font-medium tracking-wide uppercase`.

## Layout

Two widths, and only two:

- **Reading column** — `max-w-xl` (home), `max-w-2xl` (play), `max-w-3xl`
  (leaderboard). A quiz is a single-focus surface.
- **Work surface** — `max-w-6xl` (admin). Tables need room.

Screens that are a single card — the start screen, the admin login — are
vertically centred with `min-h-[100svh]`. A lone card pinned to the top of a tall
window reads as a page that failed to load.

## Recurring calls

- **Filters are a toolbar, never a titled Card.** Both the leaderboard and the
  questions list once wrapped their filters in a card with a heading, which made
  the controls that narrow the content heavier than the content. The table is the
  card.
- **Badges are for states you act on**, not for facts. Status earns one; mode and
  difficulty are tertiary text.
- **Housekeeping notices are one quiet line with an info icon**, never an Alert.
  Two stacked Alerts once made "why this run is 3 questions long" the loudest
  thing above a timed question.

## Motion

Almost none, deliberately.

- Question and feedback enter with `animate-in fade-in slide-in-from-bottom-1/2`,
  200–300ms, keyed by position so the entrance replays.
- The timer's fill uses `transform: scaleX` — never `width`, which would trigger
  layout every second.
- **One real animation in the whole app**: the score counts up over 700ms,
  decelerating, on the results screen. It is there because that is the only
  moment that is a payoff rather than a task. Guarded by `matchMedia` on
  `prefers-reduced-motion`, because the animation is in JavaScript and a CSS
  query cannot reach it.
- No spring, no bounce, no confetti.

## Navigation context

The admin header is the same ground as the canvas with a bottom border — never a
different colour, which would split the screen into "chrome world" and "content
world". It is sticky, and the current section is marked (`components/admin/admin-nav.tsx`),
matched longest-prefix-first: `/admin/questions/import` starts with
`/admin/questions`, so a plain prefix test lights up both.
