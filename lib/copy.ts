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
    skipToContent: 'Skip to content',
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
    'name-from-description': {
      name: 'Name it from the description',
      short: 'A description. Which component is it?',
      help: 'How the design system describes a component, without naming it. Say which one.',
    },
    mixed: {
      name: 'Mixed',
      short: 'A bit of everything',
      help: 'Questions drawn from every mode.',
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
    runHeading: 'Design system quiz run',
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
    allModes: 'All modes',
    window: 'Period',
    lastSevenDays: 'Last 7 days',
    allTime: 'All time',
    perLevelHint:
      'One board per level, not one overall: a single table would just reward grinding the easy one.',
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
    throttled: 'Too many attempts. Wait a few minutes and try again.',
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
    filtersTitle: 'Filters',
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
    rowActions: 'Actions for this question',
    untitled: 'Untitled draft',
    duplicated: 'Duplicated as a draft.',
    published: 'Published.',
    unpublished: 'Back to draft.',
    archived: 'Archived.',
    publishRefused: 'This question cannot be published yet',
    warningsTitle: 'Worth a look before this goes live',

    /** Advice, never a refusal. Shown after a successful save. */
    warnings: {
      optionCount: (difficulty: string, expected: number, actual: number) =>
        `A ${difficulty} question usually offers ${expected} options; this one offers ${actual}.`,
      noDocLink: 'No documentation link — players cannot go read more after answering.',
      noStory: (name: string) =>
        `“${name}” is in the design specs but has no Storybook story. Check it still exists before publishing.`,
      filedUnderWrongComponent: (answer: string, filed: string) =>
        `The correct option names “${answer}” but the question is filed under “${filed}”, so the stats will aggregate under the wrong component.`,
    },
    versionCut: (version: number) =>
      `Saved as version ${version}. The previous one was archived so past statistics stay honest.`,
    savedInPlace: 'Saved.',

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
      imageDrop: 'Drop a screenshot here, or choose a file',
      imageChoose: 'Choose a file',
      imageRemove: 'Remove',
      imageUploading: 'Uploading…',
      imageHint:
        'Renamed to an opaque id on upload, so the filename cannot give the answer away. PNG, JPEG or WebP, up to 2 MB.',
      noComponentFound: 'No component by that name in the design system.',
      optionsForMode: {
        'name-that-component': 'Component names to choose between',
        'which-component': 'Component names to choose between',
        'name-from-description': 'Component names to choose between',
        'which-variant': 'The variants to choose between',
        'spot-the-drift': 'The two screenshots, right and wrong',
      } satisfies Record<Mode, string>,
      fillFromGuidelines: 'Fill from the guidelines',
      fillFromGuidelinesHint:
        'Suggests prompts taken from the design guidelines, with the component names removed.',
      useThisDescription: 'Use this one',
      descriptionThin: 'Too short to identify one component',
      descriptionEditHint:
        'These are drafts. The redaction leaves rough edges — read it back as a question before publishing, and rewrite anything that does not point at exactly one component.',
      noDescriptionFor: (component: string) =>
        `The design guidelines have nothing usable for ${component} — every sentence names a sibling component, so redacting leaves nothing.`,
      fanoutLabel: 'Variants to compare',
      fanout: (count: number) =>
        count < 2 ? 'Pick at least two variants' : `Make ${count} options from these`,
      fanoutHint:
        'One option per variant, all rendered live from the design system. No screenshots to take.',
      noLiveRender: (component: string) =>
        `${component} has no CSS-UI layer, so it cannot be rendered live. Use screenshots for this one.`,
      noModifiers: (component: string) =>
        `${component} ships no modifiers, so there are no variants to compare.`,
      addOption: 'Add an option',
      removeOption: 'Remove this option',
      optionNumber: (index: number) => `Option ${index}`,
      noOptionsYet: 'No options yet.',
      pickComponentFirst: 'Pick the component this question is about first.',
      draftBadge: 'Draft',
      publishedBadge: 'Published',
      backToList: 'All questions',
      newTitle: 'New question',
      editTitle: 'Edit question',
      playsSoFar: (plays: number) => `${plays} plays so far`,

      /**
       * Why a question cannot go live yet. The rules come from the zod schema,
       * but its messages are written for developers — a designer should read
       * what to do, not what type was expected.
       */
      blockers: {
        prompt: 'Write the question prompt.',
        explanation:
          'The explanation is required, and needs to be a sentence or two: it is the part that teaches.',
        component: 'Pick the component this question is about, from the catalog.',
        image: 'This mode shows a screenshot of the component. Upload one.',
        optionCount: (min: number, max: number) =>
          min === max
            ? `This mode needs exactly ${min} options.`
            : `This mode needs between ${min} and ${max} options.`,
        optionComponent: (name: string) =>
          `“${name}” is not a component in the design system. Pick one from the list.`,
        optionEmpty: 'Every option needs to be filled in.',
        optionImage: 'Every option needs its own screenshot.',
        correctAnswer: 'Mark which option is the correct answer.',
        duplicateIds: 'Two options share the same id.',
        docUrl: 'The documentation link is not a valid URL.',
        fallback: (path: string) => `Check the ${path} field.`,
      },
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
      preview: 'Check the rows',
      commit: (count: number) => `Import ${count} questions`,
      rowsValid: (count: number) => `${count} ready`,
      rowsInvalid: (count: number) => `${count} to fix`,
      allOrNothing:
        'All or nothing: one bad row and the whole batch is refused, so you never have to hunt for what half-landed.',
      imagesSeparate:
        'Upload the screenshots through a question form first, then reference them here by their key.',
      columnsTitle: 'Columns',
      columnsHint:
        'CSV needs a header row. JSON takes the same field names, and accepts an `options` array instead of option1…option6.',
      correctHint: '`correct` is the position of the right answer, counting from 1.',
      statusHint: 'Set `status` to `draft` to import without publishing. Anything else publishes.',
      empty: 'Nothing pasted yet.',
      emptyHint: 'Paste a CSV or JSON batch above and check it before importing.',
      rowLabel: (line: number) => `Row ${line}`,
      imported: (count: number) => `Imported ${count} questions.`,
      nothingValid: 'None of these rows can be imported yet.',
      badMode: (given: string, allowed: string) =>
        `“${given}” is not a game mode. Use one of: ${allowed}.`,
      badDifficulty: (given: string, allowed: string) =>
        `“${given}” is not a level. Use one of: ${allowed}.`,
      badCorrect: (given: string, count: number) =>
        `“${given}” is not a valid answer position. Give a number between 1 and ${count}.`,
      badJson: (detail: string) => `That is not valid JSON. ${detail}`,
      copyTemplate: 'Copy a template row',
      templateCopied: 'Template copied.',
    },
  },

  stats: {
    title: 'Stats',
    overview: 'Overview',
    runs: 'Runs',
    players: 'Players',
    averageScore: 'Average score',
    bestScore: 'Best score',
    overTime: 'Over time',
    byQuestion: 'By question',
    byQuestionHint: 'Hardest first: the ones people get wrong are the ones worth rewriting.',
    byComponent: 'By component',
    byComponentHint:
      'Aggregated across every question about that component, so a blurry component shows up even when no single question looks broken.',
    byMode: 'By mode',
    byModeHint: 'Which of the four kinds of question is actually the hardest.',
    byTeam: 'By team',
    byTeamHint: 'Where the knowledge gaps are, crossed with the level played.',
    expected: 'Answer was',
    chosenInstead: 'Picked instead',
    shareOfErrors: 'Share of errors',
    occurrences: 'Times',
    questionCount: 'Questions',
    noConfusionYet: 'No wrong answers on the component-naming modes yet.',
    calibrationClear: 'Nothing to re-calibrate: every question with enough plays sits where it should.',
    singleDay: (day: string, runs: number, players: number) =>
      `Everything so far happened on ${day}: ${runs} runs from ${players} players. The trend line appears once there is a second day to compare with.`,
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
    withDigest: (digest: string) =>
      `If it keeps happening, quote this reference so it can be found in the logs: ${digest}`,
    noDigest: 'Try again. If it keeps happening, say so in the design system channel.',
    notFound: 'Nothing here.',
    notFoundHint: 'That link points at something that does not exist, or no longer does.',
    runNotFound: 'That run no longer exists.',
    questionExpired: 'That question already timed out.',
    poolTooThin: (requested: string, used: string) =>
      `Not enough unseen ${requested} questions, so some ${used} ones were mixed in.`,
    poolEmpty: 'There are no published questions for this mode yet.',
    shortRun: (drawn: number, usual: number) =>
      `This mode only has ${drawn} questions written for it so far, so this run is ${drawn} long instead of ${usual}.`,
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
