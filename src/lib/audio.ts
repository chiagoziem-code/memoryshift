import { singRhyme, speakText } from "@/lib/audio.functions";

/**
 * Audio clips are paid for once, then kept on the device (IndexedDB),
 * so replaying, reviewing and downloading never costs twice.
 */

const DB_NAME = "memoryshift-audio";
const STORE = "clips";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readClip(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeClip(key: string, blob: Blob) {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, key);
  } catch {
    /* storage full or blocked: the clip still plays this session */
  }
}

function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + text.length.toString(36);
}

function base64ToBlob(base64: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

const pending = new Map<string, Promise<Blob>>();

async function cached(key: string, make: () => Promise<Blob>): Promise<Blob> {
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    const stored = await readClip(key);
    if (stored) return stored;
    const blob = await make();
    await writeClip(key, blob);
    return blob;
  })();
  pending.set(key, job);
  job.catch(() => pending.delete(key));
  return job;
}

export type VoiceChoice = "warm" | "bright";

/** Natural-voice clip for this text (cached). */
export function speechClip(text: string, voice: VoiceChoice) {
  const clean = text.trim().slice(0, 1500);
  return cached(`speech:${voice}:${hash(clean)}`, async () => {
    const { audioBase64, mimeType } = await speakText({ data: { text: clean, voice } });
    return base64ToBlob(audioBase64, mimeType);
  });
}

/** Sung version of a rhyme (cached). */
export function songClip(lyrics: string, title?: string) {
  const clean = lyrics.trim().slice(0, 600);
  return cached(`song:${hash(clean)}`, async () => {
    const { audioBase64, mimeType } = await singRhyme({
      data: { lyrics: clean, ...(title ? { title: title.slice(0, 120) } : {}) },
    });
    return base64ToBlob(audioBase64, mimeType);
  });
}

export function hasSong(lyrics: string) {
  return readClip(`song:${hash(lyrics.trim().slice(0, 600))}`).then(Boolean);
}

export function downloadBlob(blob: Blob, name: string) {
  const ext = blob.type.includes("wav") ? "wav" : "mp3";
  const safe = name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "memory-aid";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safe}.${ext}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
