import { supabase } from "@/integrations/supabase/client";
import { loadChecks, savePilot, type RecallCheck } from "@/lib/recall";

/**
 * Parent accounts and pilot syncing.
 * The app keeps working on the device without an account. When a parent is
 * signed in and has picked a learner, memory-check results are copied to the
 * database so pilot results can be pooled across families.
 */

export const CONSENT_VERSION = "2026-10-pilot-v1";
export const AGE_BANDS = ["under-9", "9-11", "12-14", "15-17", "18+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type Learner = {
  id: string;
  nickname: string;
  age_band: string;
  pilot_mode: boolean;
};

const ACTIVE_KEY = "memoryshift.learner.v1";

export function loadActiveLearner(): Learner | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(ACTIVE_KEY) ?? "null") as Learner | null;
  } catch {
    return null;
  }
}

export function saveActiveLearner(learner: Learner | null) {
  if (typeof window === "undefined") return;
  if (learner) {
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(learner));
    savePilot(learner.pilot_mode);
  } else {
    window.localStorage.removeItem(ACTIVE_KEY);
  }
}

export async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/** Make sure a consent row exists; consent is given on the sign-up form. */
export async function ensureConsent() {
  const user = await currentUser();
  if (!user) return false;
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("parent_id", user.id)
    .eq("version", CONSENT_VERSION)
    .limit(1);
  if (data && data.length > 0) return true;
  if (user.user_metadata?.["consent_version"] !== CONSENT_VERSION) return false;
  const { error } = await supabase
    .from("consents")
    .insert({ parent_id: user.id, version: CONSENT_VERSION });
  return !error;
}

export async function recordConsent() {
  const user = await currentUser();
  if (!user) return false;
  const { error } = await supabase
    .from("consents")
    .insert({ parent_id: user.id, version: CONSENT_VERSION });
  return !error;
}

export async function listLearners(): Promise<Learner[]> {
  const { data, error } = await supabase
    .from("learners")
    .select("id, nickname, age_band, pilot_mode")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addLearner(nickname: string, ageBand: AgeBand, pilotMode: boolean) {
  const user = await currentUser();
  if (!user) throw new Error("Please sign in first");
  const { data, error } = await supabase
    .from("learners")
    .insert({ parent_id: user.id, nickname: nickname.trim(), age_band: ageBand, pilot_mode: pilotMode })
    .select("id, nickname, age_band, pilot_mode")
    .single();
  if (error) throw error;
  return data as Learner;
}

export async function setLearnerPilot(id: string, pilotMode: boolean) {
  const { error } = await supabase.from("learners").update({ pilot_mode: pilotMode }).eq("id", id);
  if (error) throw error;
}

/** Deletes the learner and, through the database, all of their results. */
export async function deleteLearner(id: string) {
  const { error } = await supabase.from("learners").delete().eq("id", id);
  if (error) throw error;
}

/** Copy one memory check (and its attempts) to the database. Quietly does nothing when signed out. */
export async function syncCheck(check: RecallCheck): Promise<boolean> {
  const learnerId = check.learnerId ?? loadActiveLearner()?.id;
  if (!learnerId) return false;
  const user = await currentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("recall_checks")
    .upsert(
      {
        learner_id: learnerId,
        set_id: check.setId,
        subject: check.subject,
        arm: check.arm,
        formats: [...new Set((check.formats ?? []) as string[])],
        questions: check.questions,
        created_at: check.createdAt,
      },
      { onConflict: "learner_id,set_id" },
    )
    .select("id")
    .single();
  if (error || !data) return false;

  if (check.attempts.length > 0) {
    const { error: attemptError } = await supabase.from("recall_attempts").upsert(
      check.attempts.map((a) => ({
        check_id: data.id,
        stage: a.stage,
        answers: a.answers,
        correct: a.correct,
        total: a.total,
        at: a.at,
      })),
      { onConflict: "check_id,stage" },
    );
    if (attemptError) return false;
  }
  return true;
}

/** Fire-and-forget version for use right after saving on the device. */
export function syncCheckInBackground(check: RecallCheck) {
  void syncCheck(check).catch(() => undefined);
}

/** Upload this device's memory checks for the active learner (plus older untagged ones). */
export async function syncAll() {
  const active = loadActiveLearner();
  if (!active) return 0;
  let synced = 0;
  for (const check of loadChecks().filter((c) => !c.learnerId || c.learnerId === active.id)) {
    if (await syncCheck(check)) synced++;
  }
  return synced;
}
