export type FormatId =
  | "acronym"
  | "rhyme"
  | "story"
  | "visual"
  | "palace"
  | "chunk"
  | "sketch"
  | "movement"
  | "analogy";

export type MnemonicFormat = {
  id: FormatId;
  name: string;
  tagline: string;
  emoji: string;
};

export const FORMATS: MnemonicFormat[] = [
  { id: "acronym", name: "Acronym & first letters", tagline: "Short letter cues you can say out loud", emoji: "🔤" },
  { id: "rhyme", name: "Rhyme or song", tagline: "Rhythm and melody carry the facts", emoji: "🎵" },
  { id: "story", name: "Story chain", tagline: "Facts linked into one silly story", emoji: "📖" },
  { id: "visual", name: "Vivid picture", tagline: "One strong image described in detail", emoji: "🖼️" },
  { id: "palace", name: "Memory palace", tagline: "Facts placed around a room you know", emoji: "🏠" },
  { id: "chunk", name: "Chunks & patterns", tagline: "Big information split into small groups", emoji: "🧩" },
  { id: "sketch", name: "Doodle plan", tagline: "A simple drawing you make yourself", emoji: "✏️" },
  { id: "movement", name: "Movement & gesture", tagline: "A hand sign or action per step", emoji: "🙌" },
  { id: "analogy", name: "Everyday comparison", tagline: "Explained as something familiar", emoji: "⚖️" },
];

export const formatById = (id: FormatId) => FORMATS.find((f) => f.id === id)!;

export type QuizOption = { label: string; weights: Partial<Record<FormatId, number>> };
export type QuizQuestion = { id: string; question: string; options: QuizOption[] };

export const QUIZ: QuizQuestion[] = [
  {
    id: "recall",
    question: "You remembered something tricky last week. What helped most?",
    options: [
      { label: "A tune or rhyme stuck in my head", weights: { rhyme: 3, movement: 1 } },
      { label: "A picture I could see in my mind", weights: { visual: 3, sketch: 1 } },
      { label: "A short story about it", weights: { story: 3, analogy: 1 } },
      { label: "A short set of letters or a code", weights: { acronym: 3, chunk: 1 } },
    ],
  },
  {
    id: "reading",
    question: "When a page has lots of words, what do you wish happened?",
    options: [
      { label: "Break it into small pieces", weights: { chunk: 3, acronym: 1 } },
      { label: "Turn it into pictures", weights: { visual: 3, sketch: 2 } },
      { label: "Say it as a story I can follow", weights: { story: 3 } },
      { label: "Compare it to something I already know", weights: { analogy: 3 } },
    ],
  },
  {
    id: "body",
    question: "Do you like to move while you learn?",
    options: [
      { label: "Yes, I need to move or use my hands", weights: { movement: 3, sketch: 1 } },
      { label: "Sometimes, tapping a rhythm helps", weights: { rhyme: 2, movement: 2 } },
      { label: "I prefer to sit still and picture things", weights: { visual: 2, palace: 2 } },
      { label: "I like to write or draw it out", weights: { sketch: 3, chunk: 1 } },
    ],
  },
  {
    id: "space",
    question: "Could you walk through your bedroom in your head right now?",
    options: [
      { label: "Easily, every corner", weights: { palace: 3, visual: 1 } },
      { label: "Roughly", weights: { palace: 1, visual: 2 } },
      { label: "Not really", weights: { rhyme: 2, acronym: 1 } },
    ],
  },
  {
    id: "numbers",
    question: "How do numbers and formulas feel?",
    options: [
      { label: "Easier as steps and groups", weights: { chunk: 3 } },
      { label: "Easier if each part becomes a character", weights: { story: 2, visual: 2 } },
      { label: "Easier as a chant I repeat", weights: { rhyme: 3 } },
      { label: "Easier as a real-life example", weights: { analogy: 3 } },
    ],
  },
  {
    id: "length",
    question: "How long should a memory aid be?",
    options: [
      { label: "Very short, a few words", weights: { acronym: 3, chunk: 1 } },
      { label: "Medium, a few lines", weights: { rhyme: 2, analogy: 2 } },
      { label: "Longer is fine if it is fun", weights: { story: 3, palace: 2 } },
    ],
  },
];

export type Profile = {
  scores: Record<FormatId, number>;
  favourites: FormatId[];
  avoided: FormatId[];
  calibrated: boolean;
  readingLevel: "simple" | "standard";
  updatedAt: string;
};

export const emptyScores = (): Record<FormatId, number> =>
  FORMATS.reduce((acc, f) => ({ ...acc, [f.id]: 0 }), {} as Record<FormatId, number>);

export const defaultProfile = (): Profile => ({
  scores: emptyScores(),
  favourites: [],
  avoided: [],
  calibrated: false,
  readingLevel: "simple",
  updatedAt: new Date().toISOString(),
});

export function scoreQuiz(answers: Record<string, number>): Record<FormatId, number> {
  const scores = emptyScores();
  for (const q of QUIZ) {
    const picked = answers[q.id];
    if (picked === undefined) continue;
    const option = q.options[picked];
    if (!option) continue;
    for (const [id, weight] of Object.entries(option.weights)) {
      scores[id as FormatId] += weight ?? 0;
    }
  }
  return scores;
}

export function rankFormats(profile: Profile): FormatId[] {
  return FORMATS.map((f) => f.id)
    .map((id) => ({
      id,
      score:
        (profile.scores[id] ?? 0) +
        (profile.favourites.includes(id) ? 6 : 0) -
        (profile.avoided.includes(id) ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((f) => f.id);
}

export type SavedMnemonic = {
  id: string;
  format: FormatId;
  title: string;
  body: string;
  steps: string[];
  practiceTip: string;
  sourceLabel: string;
  createdAt: string;
  liked: boolean | null;
};

const PROFILE_KEY = "memoryshift.profile.v1";
const LIBRARY_KEY = "memoryshift.library.v1";

export function loadProfile(): Profile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();
    return { ...defaultProfile(), ...(JSON.parse(raw) as Profile) };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile: Profile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }),
  );
}

export function loadLibrary(): SavedMnemonic[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? "[]") as SavedMnemonic[];
  } catch {
    return [];
  }
}

export function saveLibrary(items: SavedMnemonic[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(items.slice(0, 60)));
}

/** Nudge the profile when a learner likes or dislikes an output. */
export function recordFeedback(profile: Profile, format: FormatId, liked: boolean): Profile {
  const scores = { ...profile.scores };
  scores[format] = (scores[format] ?? 0) + (liked ? 2 : -2);
  let favourites = profile.favourites.filter((f) => f !== format);
  let avoided = profile.avoided.filter((f) => f !== format);
  if (liked && scores[format] >= 6) favourites = [...favourites, format];
  if (!liked && scores[format] <= -4) avoided = [...avoided, format];
  return { ...profile, scores, favourites, avoided };
}
