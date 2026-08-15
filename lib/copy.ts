/**
 * Every user-facing string in the app.
 *
 * Kept in one file so switching the interface to French later is a translation
 * job, not a hunt through JSX. Nothing here is interpolated at module scope —
 * anything with a variable is a function, so a translated copy stays a copy.
 */
import type { Difficulty, Mode, RunDifficulty, RunMode } from '@/lib/difficulty'

export const copy = {
  app: {
    name: 'DS Quiz',
    tagline: 'How well do you know the Agorapulse design system?',
  },

  home: {
    title: 'DS Quiz',
    subtitle: 'Five questions. One design system. No pressure.',
    pseudoLabel: 'Your name',
    pseudoPlaceholder: 'e.g. sam',
    pseudoHint: 'Shown on the leaderboard. Remembered on this device.',
    teamLabel: 'Team',
    modeLabel: 'Game mode',
    difficultyLabel: 'Difficulty',
    start: 'Start playing',
    resume: 'Resume',
    seeLeaderboard: 'Leaderboard',
    pseudoRequired: 'Pick a name first.',
  },

  teams: {
    product: 'Product',
    engineering: 'Engineering',
    design: 'Design',
    other: 'Other',
  } satisfies Record<string, string>,

  modes: {
    'name-that-component': {
      name: 'Name that component',
      short: 'A screenshot. What is it called?',
      help: 'One component, isolated. Pick its name.',
    },
    'which-variant': {
      name: 'Right variant',
      short: 'A situation. Which variant fits?',
      help: 'Same component, different variants. Only one belongs here.',
    },
    'spot-the-drift': {
      name: 'Spot the drift',
      short: 'Two screenshots. Which one is right?',
      help: 'One follows the design system, the other drifted from it.',
    },
    'which-component': {
      name: 'Which component?',
      short: 'A product scenario. What would you reach for?',
      help: 'No screenshot. Pick the component the design system intends here.',
    },
    mixed: {
      name: 'Mixed',
      short: 'A bit of everything',
      help: 'Questions drawn from all four modes.',
    },
  } satisfies Record<RunMode, { name: string; short: string; help: string }>,

  difficulties: {
    easy: {
      name: 'Easy',
      help: 'Common components, obviously different options.',
    },
    medium: {
      name: 'Medium',
      help: 'Options from the same family. Close variants.',
    },
    hard: {
      name: 'Hard',
      help: 'Components that really do look alike. Fine distinctions.',
    },
    progressive: {
      name: 'Progressive',
      help: 'Starts easy, ends hard. The best way in.',
    },
  } satisfies Record<RunDifficulty, { name: string; help: string }>,

  game: {
    questionOf: (position: number, total: number) => `Question ${position} of ${total}`,
    timeLeft: (seconds: number) => `${seconds}s left`,
    timeUp: "Time's up",
    correct: 'Correct',
    incorrect: 'Not quite',
    next: 'Next',
    finish: 'See results',
    keyboardHint: 'Press 1–6 to answer, Enter to continue.',
    optionsLabel: 'Answer options',
    /** Accessible name for an option: a screenshot on its own has none. */
    optionName: (position: number, label: string) => `Option ${position}: ${label}`,
    optionScreenshot: (label: string) => `Screenshot for option ${label}`,
    readTheDocs: 'Read the component docs',
    answerWas: (label: string) => `The answer was ${label}.`,
    streak: (count: number) => `${count} in a row`,
    pointsEarned: (points: number) => `+${points}`,
    speedBonus: 'Speed bonus',
    streakBonus: 'Streak bonus',
    abandonConfirm: 'Leave this run? Your answers so far are already recorded.',
  },

  results: {
    title: 'Run complete',
    perfect: 'Flawless. Five out of five.',
    score: (points: number) => `${points} points`,
    correctCount: (correct: number, total: number) => `${correct} of ${total} correct`,
    versusAverage: (delta: number) =>
      delta >= 0
        ? `${delta} points above the average run`
        : `${Math.abs(delta)} points below the average run`,
    rank: (position: number, difficulty: string) => `#${position} on the ${difficulty} board`,
    playAgain: 'Play again',
    reviewTitle: 'What you answered',
    backHome: 'Back to start',
  },

  leaderboard: {
    title: 'Leaderboard',
    byDifficulty: 'Difficulty',
    byTeam: 'Team',
    allTeams: 'All teams',
    lastSevenDays: 'Last 7 days',
    allTime: 'All time',
    columnRank: 'Rank',
    columnPlayer: 'Player',
    columnTeam: 'Team',
    columnScore: 'Best score',
    columnRuns: 'Runs',
    empty: 'No runs at this level yet.',
    emptyHint: 'Be the first to play it.',
  },

  admin: {
    title: 'Admin',
    passwordLabel: 'Admin password',
    signIn: 'Sign in',
    signOut: 'Sign out',
    wrongPassword: 'That password does not match.',
    navQuestions: 'Questions',
    navStats: 'Stats',
    navImport: 'Bulk import',
  },

  questions: {
    title: 'Questions',
    create: 'New question',
    duplicate: 'Duplicate',
    edit: 'Edit',
    publish: 'Publish',
    unpublish: 'Unpublish',
    archive: 'Archive',
    searchPlaceholder: 'Search prompts…',
    filterMode: 'Mode',
    filterStatus: 'Status',
    filterComponent: 'Component',
    columnPrompt: 'Prompt',
    columnMode: 'Mode',
    columnDifficulty: 'Level',
    columnStatus: 'Status',
    columnSuccess: 'Success rate',
    columnPlays: 'Plays',
    empty: 'No questions yet.',
    emptyHint: 'Write the first one, or import a batch from a spreadsheet.',
    notEnoughPlays: 'Not enough plays',

    form: {
      modeLabel: 'Game mode',
      modeHint: 'This decides the rest of the form.',
      componentLabel: 'Component',
      componentHint: 'Picked from the design system catalog. Free text is not allowed.',
      difficultyLabel: 'Difficulty',
      difficultyHint: 'Your call at writing time. The stats will tell you if you were right.',
      promptLabel: 'Prompt',
      explanationLabel: 'Explanation',
      explanationHint: 'Shown after answering, right or wrong. This is the part that teaches.',
      docUrlLabel: 'Documentation link',
      docUrlHint: 'Optional. A Storybook story or the component spec.',
      timerLabel: 'Timer override',
      timerHint: (seconds: number) => `Leave empty to use the level default (${seconds}s).`,
      optionsLabel: 'Options',
      correctLabel: 'Correct answer',
      suggestDistractors: 'Suggest distractors',
      suggestHint: 'Fills the empty options with plausible wrong answers.',
      categoryTooSmall: (category: string, available: number) =>
        `The ${category} category only holds ${available} other components, so some suggestions come from outside it.`,
      imageLabel: 'Screenshot',
      imageDrop: 'Drop a screenshot, or click to choose one',
      imageHint: 'Renamed to an opaque id on upload, so the filename cannot give the answer away.',
      imageTooLarge: 'That file is too large.',
      imageWrongType: 'Only PNG, JPEG, WebP and SVG are accepted.',
      previewTitle: 'Player preview',
      previewHint: 'Exactly what the player will see.',
      saveDraft: 'Save draft',
      savePublished: 'Save and publish',
      saved: 'Saved',
      versionNotice:
        'This question has already been answered. Saving these changes creates a new version and archives the current one, so past statistics stay honest.',
      versionNoticeSafe:
        'Explanation and documentation link can be edited in place — they do not change what was judged.',
    },

    import: {
      title: 'Bulk import',
      hint: 'Paste CSV or JSON. Nothing is written until every row passes.',
      pasteLabel: 'Rows',
      preview: 'Preview',
      commit: 'Import all',
      rowsValid: (count: number) => `${count} rows ready`,
      rowsInvalid: (count: number) => `${count} rows to fix`,
      allOrNothing: 'One row failed, so nothing was written.',
      imagesSeparate: 'Images are uploaded separately and referenced by their key.',
    },
  },

  stats: {
    title: 'Stats',
    overview: 'Overview',
    runs: 'Runs',
    players: 'Players',
    averageScore: 'Average score',
    overTime: 'Over time',
    byQuestion: 'By question',
    byComponent: 'By component',
    byMode: 'By mode',
    byTeam: 'By team',
    confusion: 'Confusion matrix',
    confusionHint: 'When the answer was X, what did players pick instead?',
    calibration: 'Calibration',
    calibrationHint:
      'Questions whose declared level disagrees with the measured success rate. Hidden below 10 plays.',
    suggestedLevel: 'Suggested level',
    declaredLevel: 'Declared level',
    successRate: 'Success rate',
    medianTime: 'Median time',
    plays: 'Plays',
    exportCsv: 'Export answers as CSV',
    empty: 'Nothing to measure yet.',
    emptyHint: 'Stats appear once people start playing.',
  },

  errors: {
    generic: 'Something went wrong.',
    retry: 'Try again',
    runNotFound: 'That run no longer exists.',
    questionExpired: 'That question already timed out.',
    poolTooThin: (requested: string, used: string) =>
      `Not enough unseen ${requested} questions, so some ${used} ones were mixed in.`,
    poolEmpty: 'There are no published questions for this mode yet.',
  },

  loading: {
    question: 'Loading the next question…',
    stats: 'Crunching the numbers…',
  },
} as const

export function modeName(mode: RunMode): string {
  return copy.modes[mode].name
}

export function difficultyName(difficulty: RunDifficulty): string {
  return copy.difficulties[difficulty].name
}

export function questionModeName(mode: Mode): string {
  return copy.modes[mode].name
}

export function realDifficultyName(difficulty: Difficulty): string {
  return copy.difficulties[difficulty].name
}
