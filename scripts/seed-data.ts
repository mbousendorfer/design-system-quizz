/**
 * Twelve starter questions, three per mode, so the game is playable end to end
 * before any real screenshot exists.
 *
 * Every claim in an explanation is grounded in the design system specs — the
 * drift examples come from `patterns/conventions.md`, the variant semantics from
 * the semantic colour families table, and the component distinctions from the
 * inputs each component actually exposes. Replace the placeholder screenshots and
 * these are real questions, not filler.
 */
import type { Difficulty, Mode } from '@/lib/difficulty'

const STORYBOOK = 'https://design.agorapulse.com'

export type SeedOption = {
  id: string
  /** Component-naming modes: the component this option offers. */
  component?: string
  /** Image modes: what the placeholder should depict, and your shot list entry. */
  shot?: string
  label?: string
}

export type SeedQuestion = {
  /** Stable key: the question's uuid and its image keys are derived from it. */
  slug: string
  mode: Mode
  difficulty: Difficulty
  component: string
  prompt: string
  explanation: string
  docUrl: string | null
  /** `name-that-component` only: the screenshot being identified. */
  shot?: string
  options: SeedOption[]
  correctOptionId: string
}

export const SEED_QUESTIONS: SeedQuestion[] = [
  // -------------------------------------------------------------------------
  // Name that component
  // -------------------------------------------------------------------------
  {
    slug: 'ntc-badge-easy',
    mode: 'name-that-component',
    difficulty: 'easy',
    component: 'Badge',
    prompt: 'Which component is this?',
    shot: 'An ap-badge: a small blue dot sitting on the top-right corner of an inbox icon',
    explanation:
      'A Badge is the small dot or count that attaches to another element to flag activity. It is read, never clicked. Modal, Paginator and Datepicker are all interactive surfaces in their own right — none of them can sit on the corner of an icon.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', component: 'Badge' },
      { id: 'b', component: 'Modal' },
      { id: 'c', component: 'Paginator' },
      { id: 'd', component: 'Datepicker' },
    ],
    correctOptionId: 'a',
  },
  {
    slug: 'ntc-segmented-medium',
    mode: 'name-that-component',
    difficulty: 'medium',
    component: 'Segmented Control',
    prompt: 'Which component is this?',
    shot: 'Three joined pill buttons inside one rounded container, the middle one filled: Day / Week / Month',
    explanation:
      'A Segmented Control holds a small set of mutually exclusive choices in one joined control, and switches a view in place. Tabs also switch views, but they sit above a panel and can scroll. A Paginator moves through pages of the same list rather than between views. A Stepper walks a sequence that has a beginning and an end.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', component: 'Tabs' },
      { id: 'b', component: 'Segmented Control' },
      { id: 'c', component: 'Nav Selector' },
      { id: 'd', component: 'Stepper' },
      { id: 'e', component: 'Paginator' },
    ],
    correctOptionId: 'b',
  },
  {
    slug: 'ntc-status-hard',
    mode: 'name-that-component',
    difficulty: 'hard',
    component: 'Status',
    prompt: 'Which component is this?',
    shot: 'A green pill with a filled dot on its left and the word Published',
    explanation:
      'This is a Status: a pill whose dot and colour carry a state the system decided. Badge is the bare dot or count attached to something else, with no label of its own. Tag is a token the user put there and can take away. Counter is a number pill. Labels are user-assigned to a conversation. Filter Chips List shows which filters are currently applied. The giveaway is the dot: Status ships with it by default and has a `no-dot` modifier to remove it.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', component: 'Badge' },
      { id: 'b', component: 'Tag' },
      { id: 'c', component: 'Status' },
      { id: 'd', component: 'Counter' },
      { id: 'e', component: 'Labels' },
      { id: 'f', component: 'Filter Chips List' },
    ],
    correctOptionId: 'c',
  },

  // -------------------------------------------------------------------------
  // Which variant
  // -------------------------------------------------------------------------
  {
    slug: 'wv-button-primary-easy',
    mode: 'which-variant',
    difficulty: 'easy',
    component: 'Button',
    prompt:
      'The composer is ready and "Schedule post" is the single most important action on the screen. Which button variant belongs here?',
    explanation:
      'The primary variant carries the one action you most want taken on a screen, and the design system picks colour families by meaning rather than hue: `main` / orange is for primary CTAs. Secondary, ghost and transparent deliberately step back so the primary stays the only obvious target. Two primaries on one screen is what makes a page feel undecided.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', shot: 'ap-button primary orange — solid orange fill, white label "Schedule post"' },
      { id: 'b', shot: 'ap-button secondary — grey fill, dark label "Schedule post"' },
      { id: 'c', shot: 'ap-button ghost — no fill, thin border, dark label "Schedule post"' },
      { id: 'd', shot: 'ap-button transparent — label only, no fill and no border' },
    ],
    correctOptionId: 'a',
  },
  {
    slug: 'wv-button-mermaid-medium',
    mode: 'which-variant',
    difficulty: 'medium',
    component: 'Button',
    prompt: 'This button opens the AI caption generator. Which variant belongs here?',
    explanation:
      'The `mermaid` gradient is reserved for AI surfaces, and the conventions say so in as many words: never decoratively. The rule is not about taste. Use it on an ordinary button and you teach people it means nothing, and then it cannot mean "AI" on the screen where that actually matters.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', shot: 'ap-button primary orange — solid orange fill, label "Generate caption"' },
      { id: 'b', shot: 'ap-button mermaid — gradient fill, label "Generate caption"' },
      { id: 'c', shot: 'ap-button blue — solid blue fill, label "Generate caption"' },
      { id: 'd', shot: 'ap-button ghost — no fill, thin border, label "Generate caption"' },
    ],
    correctOptionId: 'b',
  },
  {
    slug: 'wv-button-featurelock-hard',
    mode: 'which-variant',
    difficulty: 'hard',
    component: 'Button',
    prompt:
      'The Advocacy report is not included in this workspace’s plan. The button should invite an upgrade rather than simply fail. Which variant belongs here?',
    explanation:
      'The `locked` variant, drawn from the feature-lock purple family, says "available on another plan" while staying interactive and leading somewhere. A greyed-out disabled button says "not now, and there is nothing you can do about it" — a different message and a dead end. Red is reserved for destructive actions, so it would read as a warning about deleting something.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', shot: 'ap-button grey disabled — flat grey fill, dimmed label "Open report"' },
      {
        id: 'b',
        shot: 'ap-button locked — purple feature-lock surface with a padlock symbol, label "Open report"',
      },
      { id: 'c', shot: 'ap-button red — solid red fill, label "Open report"' },
      { id: 'd', shot: 'ap-button ghost — no fill, thin border, label "Open report"' },
    ],
    correctOptionId: 'b',
  },

  // -------------------------------------------------------------------------
  // Spot the drift
  // -------------------------------------------------------------------------
  {
    slug: 'std-button-bem-easy',
    mode: 'spot-the-drift',
    difficulty: 'easy',
    component: 'Button',
    prompt: 'Both render an orange Save button. Which one follows the design system?',
    explanation:
      'Two drifts in one on the wrong side. BEM double-dash modifiers do not exist in this design system — modifiers are plain words chained onto the base class, as in `ap-button primary orange`. And the colour is hardcoded instead of coming from `--comp-button-*`, which is exactly what turns a future theme change into a search-and-replace across the whole codebase.',
    docUrl: STORYBOOK,
    options: [
      {
        id: 'a',
        shot: 'Code: <button class="ap-button ap-button--primary" style="background-color: #ff7a00">Save</button>',
      },
      { id: 'b', shot: 'Code: <button class="ap-button primary orange">Save</button>' },
    ],
    correctOptionId: 'b',
  },
  {
    slug: 'std-input-group-wrapper-medium',
    mode: 'spot-the-drift',
    difficulty: 'medium',
    component: 'Input Group',
    prompt: 'Which markup respects the component anatomy?',
    explanation:
      'Components in this design system style their direct children — `> input`, `> i`, `> span`. Slipping an extra wrapper in between breaks that selector chain, the input silently loses its styling, and somebody patches it back with custom CSS a week later. There is already a documented wrapper for this: `ap-input-group`. Inventing `input-wrapper` is how a codebase grows a second, undocumented design system.',
    docUrl: STORYBOOK,
    options: [
      {
        id: 'a',
        shot: 'Code: <div class="ap-form-field"><div class="input-wrapper"><input type="text" /></div></div>',
      },
      {
        id: 'b',
        shot: 'Code: <div class="ap-form-field"><div class="ap-input-group"><input type="text" /></div></div>',
      },
    ],
    correctOptionId: 'b',
  },
  {
    slug: 'std-status-handrolled-hard',
    mode: 'spot-the-drift',
    difficulty: 'hard',
    component: 'Status',
    prompt: 'Both render a green "Published" pill. Which one follows the design system?',
    explanation:
      'The wrong one is a Status pill rebuilt by hand: correct today, wrong the moment the green shifts or the radius scale moves, and invisible to anyone auditing the design system. Searching the codebase for "pill" and finding nothing is not proof the component is missing — search by intent instead. Both "state pill" and "status label" lead straight to Status in the component index.',
    docUrl: STORYBOOK,
    options: [
      {
        id: 'a',
        shot: 'Code: <span style="background:#d6f5e6;color:#1d7a3a;padding:2px 8px;border-radius:12px">Published</span>',
      },
      { id: 'b', shot: 'Code: <span class="ap-status green">Published</span>' },
    ],
    correctOptionId: 'b',
  },

  // -------------------------------------------------------------------------
  // Which component
  // -------------------------------------------------------------------------
  {
    slug: 'wc-snackbar-easy',
    mode: 'which-component',
    difficulty: 'easy',
    component: 'Snackbars Thread',
    prompt:
      'A post has just been scheduled. You want to confirm it briefly, without interrupting what the user is doing, and let the message disappear on its own.',
    explanation:
      'Snackbars Thread is the transient confirmation: it appears, it is read, it leaves. A Modal demands a decision before anything else can happen, which is far too much ceremony for a success message. An Infobox is a banner that stays on the page. A Tooltip only exists while you hover, so nobody would ever see it. If you reach for the word "toast", this design system calls it Snackbars Thread.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', component: 'Modal' },
      { id: 'b', component: 'Snackbars Thread' },
      { id: 'c', component: 'Infobox' },
      { id: 'd', component: 'Tooltip' },
    ],
    correctOptionId: 'b',
  },
  {
    slug: 'wc-infobox-medium',
    mode: 'which-component',
    difficulty: 'medium',
    component: 'Infobox',
    prompt:
      'This workspace has hit its monthly publishing limit. The message has to stay on the page, carry a heading, and offer an "Upgrade plan" button.',
    explanation:
      'Infobox is the one that can do all three: it takes a `title`, an action button with its own click output, and a `closable` flag — and its `type` even includes `feature-lock` for exactly this situation. Notification looks similar but only exposes a `type`: no heading, no button, so it cannot carry the call to action. A snackbar would vanish before the sentence is finished, and a Confirm Modal blocks the work to ask a question nobody asked.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', component: 'Snackbars Thread' },
      { id: 'b', component: 'Notification' },
      { id: 'c', component: 'Infobox' },
      { id: 'd', component: 'Tooltip' },
      { id: 'e', component: 'Confirm Modal' },
    ],
    correctOptionId: 'c',
  },
  {
    slug: 'wc-filter-chips-hard',
    mode: 'which-component',
    difficulty: 'hard',
    component: 'Filter Chips List',
    prompt:
      'The inbox is currently filtered by three criteria. You want to show them above the list, each one removable in a single click.',
    explanation:
      'Filter Chips List is the row of filters currently applied — both "active filters" and "filter chips" map onto it in the component index, and it exposes the items and a change output for removal. Tag is the generic removable token underneath, but the list is the documented component and rebuilding it from Tags is drift. Filter Dropdown is where you choose the filters, not where you see them. Labels and Labels Selector are about labels a user assigns to a conversation, which is a different concept that merely looks alike.',
    docUrl: STORYBOOK,
    options: [
      { id: 'a', component: 'Tag' },
      { id: 'b', component: 'Filter Chips List' },
      { id: 'c', component: 'Labels' },
      { id: 'd', component: 'Filter Dropdown' },
      { id: 'e', component: 'Labels Selector' },
      { id: 'f', component: 'Segmented Control' },
    ],
    correctOptionId: 'b',
  },
]
