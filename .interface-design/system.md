# DS Quiz — the design system of the thing that quizzes you about a design system

## The idea

The greys are shadcn's own. The **colour** comes from the Agorapulse design
system, and only where it means something — every value converted from its real
`--ref-color-*` hex to oklch, never mixed by hand.

| Role | Token | Value |
| --- | --- | --- |
| Primary action | `--primary` | orange-100 `#FF6726` |
| Interaction, focus | `--ring` | electric-blue-100 `#178DFE` |
| Success, right answer | `--success` | green-100 `#45B854` |
| Error, wrong answer | `--destructive` | red-100 `#E81313` |
| Charts | `--chart-1..5` | the DS data palette (sky, emerald, sun, iris, cherry) |

**`--accent` stays grey, and the rule has a boundary that matters.** `--accent`
is what shadcn paints hovered and selected surfaces with, including the option
toggles. *While the question is live*, a coloured wash under the option the
player is hovering is a thumb on the scale — on a `which-variant` question
comparing a blue button against an orange one it is worse than that.

*Once the answer is in, that concern is over.* The first version of this rule did
not draw the line and applied it to the verdict too, which left the single most
important thing on the screen — which option was right — as a small chip at the
far right edge of a row identical to every other. The verdict now takes the whole
row: tinted surface, coloured border, the number chip replaced by a tick or a
cross, the losing options faded back.

Colour is never the only carrier. Every verdict says it three ways — colour,
icon, and the word — so it survives colour blindness and a screenshot in
grayscale.

A verdict is coloured by meaning rather than by the button palette: a right
answer is green, not the primary orange.

**The clock is green, then yellow, then red**, at half and a fifth of the time
remaining, in the same three semantic families the rest of the app uses for the
same three ideas. It was a one-pixel hairline once. Honest about how little it
now enforces, and far too quiet for the thing a player is racing.

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

`app/globals.css`.

- **Elevation:** background → card → popover, a few percent of lightness apart.
  You should not see a step; you should only read the stack.
- **Text:** `foreground`, `--text-secondary`, `--text-tertiary`. Two levels is
  not a hierarchy.
- Adding a colour means adding a token with a stated meaning. A hex in a
  className is drift.

## Depth

Borders and surface shifts carry most of it; borders live at 9–13% opacity so
they disappear until you look for them.

**Cards lift, and only the outermost one.** A shadow in light mode, a hairline of
light along the top edge in dark, where a shadow barely reads. A nested card gets
none — there is never an elevation inside an elevation. This started as
"no shadows anywhere", which was right for a dense tool and too austere for
something people play.

## Type

- Body: the sans stack.
- **Every number a person compares or watches change is monospace and
  `tabular-nums`** — scores, ranks, timers, metric tiles, points. Proportional
  digits make a countdown jitter and make a row of tiles read as unrelated facts.
- Labels above figures: `text-xs font-medium`. **Never uppercase** — a house
  rule, and one this codebase broke twice before it stuck.

## Layout

Two widths, and only two:

- **Reading column** — `max-w-xl` (home), `max-w-2xl` (play), `max-w-3xl`
  (leaderboard). A quiz is a single-focus surface.
- **Work surface** — `max-w-6xl`. Tables need room. (The admin used it; it is
  gone with the static build, and the leaderboard is the only table left.)

Screens that are a single card — the start screen, the admin login — are
vertically centred with `min-h-[100svh]`. A lone card pinned to the top of a tall
window reads as a page that failed to load.

## Pickers say what you are choosing between

A row of chips carrying only names makes you click each one to read a sentence.
Both pickers are grids of cards carrying the fact that decides it: the difficulty
cards print options, seconds and multiplier; the mode cards print how many
questions are in each. A mode with none says so and cannot be chosen —
`aria-disabled`, not `disabled`, so it stays in the tab order and can say why.

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
- **Confetti on a right answer**, fired from the option that was clicked, and
  again on a flawless run. Hand-rolled on a canvas in
  `components/game/confetti.tsx`: it never blocks a click, it drops its particles
  and cancels its frame when they leave the viewport rather than idling a rAF
  loop, and it does nothing at all under reduced motion. A celebration for two
  out of five would be the app being pleased with itself on your behalf, so it is
  only for a right answer and a clean sweep.
- No spring, no bounce.

## Navigation context

Kept from the admin, which the static build removed, because it is the rule
rather than the screen: a header is the same ground as the canvas with a bottom
border — never a different colour, which would split the screen into "chrome
world" and "content world" — and the current section is always marked.
