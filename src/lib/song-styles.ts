/** Musical styles a learner can pick when composing a memory song. Safe for browser and server. */
export const SONG_STYLES = [
  {
    id: "pop",
    name: "Bouncy pop",
    emoji: "🎹",
    prompt: "A bouncy, cheerful children's pop song with bright piano and handclaps, about 100 BPM",
  },
  {
    id: "folk",
    name: "Gentle folk",
    emoji: "🎸",
    prompt: "A gentle acoustic folk children's song with soft guitar and glockenspiel, about 90 BPM",
  },
  {
    id: "march",
    name: "Marching band",
    emoji: "🥁",
    prompt: "A fun marching-band children's song with snare drum, brass and a steady march beat, about 100 BPM",
  },
  {
    id: "funk",
    name: "Funky groove",
    emoji: "🕺",
    prompt: "A playful funky children's song with bass guitar, drums and handclaps, about 100 BPM",
  },
  {
    id: "rap",
    name: "Chant & rap",
    emoji: "🎤",
    prompt: "A friendly, clear children's rap chant over a simple hip-hop beat, about 90 BPM",
  },
  {
    id: "lullaby",
    name: "Calm lullaby",
    emoji: "🌙",
    prompt: "A soft, calm children's lullaby with music box and warm strings, about 75 BPM",
  },
] as const;

export type SongStyleId = (typeof SONG_STYLES)[number]["id"];

export const SONG_STYLE_IDS = SONG_STYLES.map((s) => s.id) as [SongStyleId, ...SongStyleId[]];

export function songStyleById(id: string | undefined) {
  return SONG_STYLES.find((s) => s.id === id) ?? SONG_STYLES[0];
}

/** Rhymes longer than this get a full-length song so every line fits; shorter ones a 30-second clip. */
export const LONG_SONG_LINES = 6;

export function isLongSong(lyrics: string) {
  return lyrics.split("\n").filter((l) => l.trim()).length > LONG_SONG_LINES || lyrics.length > 320;
}
