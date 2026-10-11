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
  setId: string;
  format: FormatId;
  title: string;
  body: string;
  steps: string[];
  practiceTip: string;
  sourceLabel: string;
  createdAt: string;
  liked: boolean | null;
  favourite?: boolean;
  /** Spaced repetition box: 0 = new, higher = longer gap. */
  box?: number;
  dueAt?: string;
  reviews?: number;
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
  window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(items.slice(0, 200)));
  notifyLearnerData();
}

export const LEARNER_DATA_EVENT = "memoryshift:data";
export function notifyLearnerData() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LEARNER_DATA_EVENT));
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

/* ---------------- Spaced repetition ---------------- */

/** Days until the next review for each box. */
export const BOX_GAPS_DAYS = [0, 1, 2, 4, 8, 16, 32];

export type Confidence = "again" | "unsure" | "solid";

export function isDue(item: SavedMnemonic, now = Date.now()) {
  if (!item.dueAt) return true;
  return new Date(item.dueAt).getTime() <= now;
}

export function dueItems(items: SavedMnemonic[], now = Date.now()) {
  return items.filter((item) => isDue(item, now));
}

/** Move an item forward or back in the spaced-repetition schedule. */
export function gradeItem(item: SavedMnemonic, confidence: Confidence): SavedMnemonic {
  const current = item.box ?? 0;
  const box =
    confidence === "again"
      ? 0
      : confidence === "unsure"
        ? Math.max(0, Math.min(current, BOX_GAPS_DAYS.length - 1))
        : Math.min(current + 1, BOX_GAPS_DAYS.length - 1);
  const gapDays = confidence === "again" ? 0 : Math.max(BOX_GAPS_DAYS[box] ?? 1, 1);
  const dueAt = new Date(Date.now() + gapDays * 24 * 60 * 60 * 1000).toISOString();
  return { ...item, box, dueAt, reviews: (item.reviews ?? 0) + 1 };
}

export function updateLibraryItem(id: string, change: (item: SavedMnemonic) => SavedMnemonic) {
  const next = loadLibrary().map((item) => (item.id === id ? change(item) : item));
  saveLibrary(next);
  return next;
}

export type MnemonicSet = {
  setId: string;
  label: string;
  createdAt: string;
  items: SavedMnemonic[];
};

export function groupIntoSets(items: SavedMnemonic[]): MnemonicSet[] {
  const map = new Map<string, MnemonicSet>();
  for (const item of items) {
    const setId = item.setId ?? item.id;
    const existing = map.get(setId);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(setId, {
        setId,
        label: item.sourceLabel || "My material",
        createdAt: item.createdAt,
        items: [item],
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/* ---------------- Review history & analytics ---------------- */

export type ReviewEvent = {
  id: string;
  itemId: string;
  setId: string;
  format: FormatId;
  confidence: Confidence;
  boxAfter: number;
  at: string;
};

const REVIEWS_KEY = "memoryshift.reviews.v1";
const MAX_EVENTS = 500;

export function loadReviewLog(): ReviewEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(REVIEWS_KEY) ?? "[]") as ReviewEvent[];
  } catch {
    return [];
  }
}

export function saveReviewLog(events: ReviewEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  notifyLearnerData();
}

export function logReview(item: SavedMnemonic, confidence: Confidence, boxAfter: number) {
  const event: ReviewEvent = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    setId: item.setId ?? item.id,
    format: item.format,
    confidence,
    boxAfter,
    at: new Date().toISOString(),
  };
  saveReviewLog([event, ...loadReviewLog()]);
  return event;
}

const CONFIDENCE_VALUE: Record<Confidence, number> = { again: 0, unsure: 0.5, solid: 1 };

export type DayPoint = { date: string; label: string; reviews: number; confidence: number };

/** Average confidence per day for the last `days` days (oldest first). */
export function confidenceTrend(events: ReviewEvent[], days = 14): DayPoint[] {
  const points: DayPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const onDay = events.filter((e) => e.at.slice(0, 10) === key);
    const confidence =
      onDay.length === 0
        ? 0
        : onDay.reduce((sum, e) => sum + CONFIDENCE_VALUE[e.confidence], 0) / onDay.length;
    points.push({
      date: key,
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      reviews: onDay.length,
      confidence,
    });
  }
  return points;
}

export type UpcomingBucket = { key: string; label: string; count: number };

export function upcomingReviews(items: SavedMnemonic[], now = Date.now()): UpcomingBucket[] {
  const day = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + day;
  const buckets: UpcomingBucket[] = [
    { key: "due", label: "Ready now", count: 0 },
    { key: "tomorrow", label: "Tomorrow", count: 0 },
    { key: "week", label: "This week", count: 0 },
    { key: "later", label: "Later", count: 0 },
  ];
  for (const item of items) {
    const at = item.dueAt ? new Date(item.dueAt).getTime() : now;
    if (at <= now) buckets[0]!.count++;
    else if (at < endOfToday + day) buckets[1]!.count++;
    else if (at < endOfToday + 7 * day) buckets[2]!.count++;
    else buckets[3]!.count++;
  }
  return buckets;
}

export type FormatInsight = {
  format: FormatId;
  reviews: number;
  solidRate: number;
  confidence: number;
  cards: number;
};

/** How well each format is working for this learner, best first. */
export function formatInsights(
  items: SavedMnemonic[],
  events: ReviewEvent[],
): FormatInsight[] {
  return FORMATS.map((format) => {
    const own = events.filter((e) => e.format === format.id);
    const solid = own.filter((e) => e.confidence === "solid").length;
    return {
      format: format.id,
      reviews: own.length,
      solidRate: own.length === 0 ? 0 : solid / own.length,
      confidence:
        own.length === 0
          ? 0
          : own.reduce((sum, e) => sum + CONFIDENCE_VALUE[e.confidence], 0) / own.length,
      cards: items.filter((i) => i.format === format.id).length,
    };
  })
    .filter((insight) => insight.cards > 0 || insight.reviews > 0)
    .sort((a, b) => b.confidence - a.confidence || b.reviews - a.reviews);
}

export function reviewStreak(events: ReviewEvent[]): number {
  if (events.length === 0) return 0;
  const dates = new Set(events.map((e) => e.at.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------------- Learner storage (one place for everything) ---------------- */

export const STORAGE_KEYS = {
  profile: PROFILE_KEY,
  library: LIBRARY_KEY,
  reviews: REVIEWS_KEY,
  access: "memoryshift.a11y.v1",
} as const;

export type LearnerBackup = {
  version: 1;
  exportedAt: string;
  profile: unknown;
  library: unknown;
  reviews: unknown;
  access: unknown;
};

export function exportLearnerData(): LearnerBackup {
  const read = (key: string) => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  };
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: read(STORAGE_KEYS.profile),
    library: read(STORAGE_KEYS.library),
    reviews: read(STORAGE_KEYS.reviews),
    access: read(STORAGE_KEYS.access),
  };
}

export function importLearnerData(backup: LearnerBackup) {
  if (typeof window === "undefined") return;
  const write = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  };
  write(STORAGE_KEYS.profile, backup.profile);
  write(STORAGE_KEYS.library, backup.library);
  write(STORAGE_KEYS.reviews, backup.reviews);
  write(STORAGE_KEYS.access, backup.access);
}

export function clearLearnerData() {
  if (typeof window === "undefined") return;
  for (const key of Object.values(STORAGE_KEYS)) window.localStorage.removeItem(key);
}
