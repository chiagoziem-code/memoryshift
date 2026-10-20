import { singRhyme, speakText } from "@/lib/audio.functions";
import type { SongStyleId } from "@/lib/song-styles";

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
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      /* storage full or blocked: the clip still plays this session */
      resolve();
    }
  });
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

const songKey = (lyrics: string) => `song:${hash(lyrics.trim().slice(0, 600))}`;
const SONG_INFO_KEY = "memoryshift.songs.v1";

export type SongInfo = { style: SongStyleId; composedAt: string };

function readSongInfo(): Record<string, SongInfo> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SONG_INFO_KEY) ?? "{}") as Record<string, SongInfo>;
  } catch {
    return {};
  }
}

/** Which style the kept song for these lyrics was composed in, and when. */
export function songInfo(lyrics: string): SongInfo | null {
  return readSongInfo()[songKey(lyrics)] ?? null;
}

/** Sung version of a rhyme: plays the kept song, or composes one the first time. */
export function songClip(lyrics: string, title?: string) {
  const clean = lyrics.trim().slice(0, 600);
  return cached(songKey(clean), async () => {
    const { audioBase64, mimeType } = await singRhyme({
      data: { lyrics: clean, ...(title ? { title: title.slice(0, 120) } : {}) },
    });
    saveSongInfo(clean, "pop");
    return base64ToBlob(audioBase64, mimeType);
  });
}

function saveSongInfo(lyrics: string, style: SongStyleId) {
  if (typeof window === "undefined") return;
  const all = readSongInfo();
  all[songKey(lyrics)] = { style, composedAt: new Date().toISOString() };
  window.localStorage.setItem(SONG_INFO_KEY, JSON.stringify(all));
}

/**
 * Compose a brand-new song for this rhyme in the chosen style (one paid generation per press),
 * and keep it as the rhyme's song so Review, Studio and downloads replay it for free.
 */
export function composeSong(lyrics: string, style: SongStyleId, title?: string) {
  const clean = lyrics.trim().slice(0, 600);
  const key = songKey(clean);
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    const { audioBase64, mimeType } = await singRhyme({
      data: { lyrics: clean, style, ...(title ? { title: title.slice(0, 120) } : {}) },
    });
    const blob = base64ToBlob(audioBase64, mimeType);
    await writeClip(key, blob);
    saveSongInfo(clean, style);
    return blob;
  })();
  pending.set(key, job);
  void job.finally(() => pending.delete(key)).catch(() => undefined);
  return job;
}

export function hasSong(lyrics: string) {
  return readClip(songKey(lyrics)).then(Boolean);
}

/** The song already kept on this device for these lyrics, if any (never makes a new one). */
export function storedSong(lyrics: string) {
  return readClip(songKey(lyrics));
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
