import type { SavedMnemonic } from "@/lib/mnemonics";

/**
 * Memory checks: a few quick questions about the material, asked
 * before studying (what you already knew), right after, and the next day.
 * The next-day score minus the before score is the learning that stuck.
 *
 * Pilot mode adds a fair comparison: each new set is randomly studied
 * either with memory aids or as plain notes, so we can compare the two.
 */

export type RecallQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
};

export type RecallStage = "before" | "now" | "nextDay";

export type RecallAttempt = {
  stage: RecallStage;
  answers: number[]; // -1 = "I don't know yet"
  correct: number;
  total: number;
  at: string;
};

export type StudyArm = "aids" | "plain";

export type RecallCheck = {
  setId: string;
  subject: string;
  material: string;
  arm: StudyArm;
  /** Memory-aid formats made for this topic. */
  formats?: string[];
  /** Learner (from a parent account) this check belongs to, if any. */
  learnerId?: string;
  questions: RecallQuestion[];
  attempts: RecallAttempt[];
  createdAt: string;
  /** Plain-notes sets keep their memory aids here until the next-day check is done. */
  heldBack?: SavedMnemonic[];
};

export const NEXT_DAY_HOURS = 20;
export const STAGE_LABEL: Record<RecallStage, string> = {
  before: "Before",
  now: "Right after",
  nextDay: "Next day",
};

const RECALL_KEY = "memoryshift.recall.v1";
const PILOT_KEY = "memoryshift.pilot.v1";

export function loadChecks(): RecallCheck[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECALL_KEY) ?? "[]") as RecallCheck[];
  } catch {
    return [];
  }
}

export function saveChecks(checks: RecallCheck[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECALL_KEY, JSON.stringify(checks.slice(0, 200)));
}

export function upsertCheck(check: RecallCheck) {
  const rest = loadChecks().filter((c) => c.setId !== check.setId);
  saveChecks([check, ...rest]);
}

export function getCheck(setId: string) {
  return loadChecks().find((c) => c.setId === setId) ?? null;
}

export function scoreAnswers(questions: RecallQuestion[], answers: number[]) {
  return questions.reduce((sum, q, i) => sum + (answers[i] === q.answerIndex ? 1 : 0), 0);
}

export function addAttempt(check: RecallCheck, stage: RecallStage, answers: number[]): RecallCheck {
  const attempt: RecallAttempt = {
    stage,
    answers,
    correct: scoreAnswers(check.questions, answers),
    total: check.questions.length,
    at: new Date().toISOString(),
  };
  return {
    ...check,
    attempts: [...check.attempts.filter((a) => a.stage !== stage), attempt],
  };
}

export function attemptFor(check: RecallCheck, stage: RecallStage) {
  return check.attempts.find((a) => a.stage === stage) ?? null;
}

export function percent(attempt: RecallAttempt | null) {
  if (!attempt || attempt.total === 0) return null;
  return Math.round((attempt.correct / attempt.total) * 100);
}

export function hoursSince(iso: string, now = Date.now()) {
  return (now - new Date(iso).getTime()) / (60 * 60 * 1000);
}

/** Next-day checks that are ready and not yet done. */
export function nextDayDue(checks: RecallCheck[], now = Date.now()) {
  return checks.filter(
    (c) => !attemptFor(c, "nextDay") && hoursSince(c.createdAt, now) >= NEXT_DAY_HOURS,
  );
}

/** Next-day checks still waiting for the gap to pass. */
export function nextDayWaiting(checks: RecallCheck[], now = Date.now()) {
  return checks.filter(
    (c) => !attemptFor(c, "nextDay") && hoursSince(c.createdAt, now) < NEXT_DAY_HOURS,
  );
}

export type ArmSummary = {
  arm: StudyArm;
  sets: number;
  before: number | null;
  nextDay: number | null;
  gain: number | null;
};

const avg = (values: number[]) =>
  values.length === 0 ? null : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

/** Average scores for sets that have both a before and a next-day check. */
export function summariseArm(checks: RecallCheck[], arm: StudyArm): ArmSummary {
  const complete = checks.filter(
    (c) => c.arm === arm && attemptFor(c, "before") && attemptFor(c, "nextDay"),
  );
  const before = complete.map((c) => percent(attemptFor(c, "before"))!);
  const nextDay = complete.map((c) => percent(attemptFor(c, "nextDay"))!);
  const b = avg(before);
  const n = avg(nextDay);
  return { arm, sets: complete.length, before: b, nextDay: n, gain: b === null || n === null ? null : n - b };
}

/* ---------------- Pilot mode ---------------- */

export function loadPilot(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PILOT_KEY) === "on";
}

export function savePilot(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PILOT_KEY, on ? "on" : "off");
}

/**
 * Keep the two arms balanced: pick whichever arm has fewer sets so far,
 * and flip a coin on a tie.
 */
export function pickArm(checks: RecallCheck[]): StudyArm {
  const aids = checks.filter((c) => c.arm === "aids").length;
  const plain = checks.filter((c) => c.arm === "plain").length;
  if (aids < plain) return "aids";
  if (plain < aids) return "plain";
  return Math.random() < 0.5 ? "aids" : "plain";
}

export const RECALL_STORAGE_KEYS = { recall: RECALL_KEY, pilot: PILOT_KEY } as const;
