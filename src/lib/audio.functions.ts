import { createServerFn } from "@tanstack/react-start";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createResponsesModel, responsesProviderOptions } from "./ai-gateway.server";
import { localeGuide } from "./locale";
import { SONG_STYLE_IDS, isLongSong, songStyleById } from "@/lib/song-styles";

/**
 * Natural-voice speech and sung rhymes through the Lovable AI gateway.
 * Every caller in the app falls back to the device voice if these fail,
 * so a failure here never blocks learning.
 */

const GATEWAY = process.env["AI_GATEWAY_URL"] ?? "https://ai.gateway.lovable.dev/v1";
const TTS_MODEL = "google/gemini-2.5-flash-tts";
/** 30-second clips for short rhymes; full-length tracks so long rhymes fit. */
const MUSIC_MODEL = "google/lyria-3-clip-preview";
const MUSIC_MODEL_LONG = "google/lyria-3-pro-preview";

/**
 * Voices for children aged 9 to 14. Each is a Gemini prebuilt voice plus a
 * speaking style. For Nigerian learners the style asks for a warm Nigerian
 * English accent, slow pace and short pauses, which suits dyslexic and
 * neurodivergent listeners who need time to process.
 */
export const VOICES = {
  teacher: {
    label: "Aunty Teacher",
    blurb: "Warm, patient and kind",
    gemini: "Sulafat",
    role: "a kind, patient primary school teacher reading to a child she is proud of",
  },
  bigbrother: {
    label: "Big Brother",
    blurb: "Friendly and upbeat",
    gemini: "Achird",
    role: "a friendly, upbeat big brother helping with homework, encouraging but never rushed",
  },
  storyteller: {
    label: "Storyteller",
    blurb: "Gentle and calm, like a bedtime story",
    gemini: "Vindemiatrix",
    role: "a gentle storyteller telling a tale to children in the evening",
  },
} as const;

export type VoiceId = keyof typeof VOICES;
export type Accent = "ng" | "intl";

function speakingStyle(voice: VoiceId, accent: Accent) {
  const who = VOICES[voice].role;
  const accentLine =
    accent === "ng"
      ? "Speak in a natural, warm Nigerian English accent, like "
      : "Speak in clear, neutral English, like ";
  return `${accentLine}${who}. Go slowly and clearly, smile in your voice, pause briefly between sentences and before each new step, and say tricky words carefully. Never sound robotic or rushed.`;
}

function gatewayKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

function headers(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Lovable-API-Key": key,
    "Content-Type": "application/json",
    "X-Lovable-AIG-SDK": "fetch",
  };
}

async function gatewayError(response: Response, what: string) {
  const detail = (await response.text().catch(() => "")).slice(0, 300);
  if (response.status === 402) return new Error(`${what} failed (402): AI credits ran out`);
  if (response.status === 429)
    return new Error(`${what} failed (429): Too many requests, try again in a minute`);
  return new Error(`${what} failed (${response.status}): ${detail}`);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(base64: string) {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Wrap raw 16-bit mono PCM in a WAV header so an <audio> element can play it. */
function pcmToWav(pcm: Uint8Array, sampleRate = 24000) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

/** Find the first base64 audio payload in a JSON response, whatever its shape. */
function findAudio(node: unknown): { data: string; mimeType: string } | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const inline = (record["inlineData"] ?? record["inline_data"]) as Record<string, unknown> | undefined;
  if (inline && typeof inline["data"] === "string") {
    const mimeType = String(inline["mimeType"] ?? inline["mime_type"] ?? "audio/pcm");
    return { data: inline["data"], mimeType };
  }
  for (const key of ["audio", "data", "b64_json", "audio_content", "audioContent"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 200) return { data: value, mimeType: "audio/pcm" };
  }
  for (const value of Object.values(record)) {
    const found = findAudio(value);
    if (found) return found;
  }
  return null;
}

/** Recognise a ready-made audio file from its first bytes (WAV, MP3, Ogg). */
function sniff(bytes: Uint8Array): string | null {
  const ascii = (start: number, n: number) => String.fromCharCode(...bytes.subarray(start, start + n));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio/wav";
  if (bytes.length > 3 && ascii(0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length > 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes.length > 4 && ascii(0, 4) === "OggS") return "audio/ogg";
  return null;
}

/** Turn whatever the gateway sent back into a browser-playable file. */
async function toPlayable(response: Response) {
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    const found = findAudio(await response.json());
    if (!found) throw new Error("Speech failed: no audio in the response");
    const bytes = fromBase64(found.data);
    const sniffed = sniff(bytes);
    if (sniffed) return { audioBase64: found.data, mimeType: sniffed };
    const mime = found.mimeType.toLowerCase();
    if (mime.includes("mpeg") || mime.includes("mp3")) return { audioBase64: found.data, mimeType: "audio/mpeg" };
    if (mime.includes("wav")) return { audioBase64: found.data, mimeType: "audio/wav" };
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
    return { audioBase64: toBase64(pcmToWav(bytes, rate)), mimeType: "audio/wav" };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const sniffed = sniff(bytes);
  if (sniffed) return { audioBase64: toBase64(bytes), mimeType: sniffed };
  if (type.includes("pcm") || type.includes("l16")) {
    return { audioBase64: toBase64(pcmToWav(bytes)), mimeType: "audio/wav" };
  }
  return { audioBase64: toBase64(bytes), mimeType: type.startsWith("audio/") ? type.split(";")[0]! : "audio/mpeg" };
}

const SpeakInput = z.object({
  text: z.string().min(1).max(1500),
  voice: z.enum(["teacher", "bigbrother", "storyteller"]).default("teacher"),
  accent: z.enum(["ng", "intl"]).default("ng"),
});

type SpeechAttempt = { name: string; body: Record<string, unknown> };

/**
 * The gateway passes speech requests through to the provider, and the exact
 * shape it accepts has varied. We try the known shapes in order, remember the
 * one that works for the rest of this server's life, and if all fail report
 * every error so the cause is visible.
 */
function speechAttempts(text: string, voice: VoiceId, accent: Accent): SpeechAttempt[] {
  const voiceName = VOICES[voice].gemini;
  const style = speakingStyle(voice, accent);
  const generationConfig = {
    responseModalities: ["AUDIO"],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
  };
  return [
    {
      name: "gemini",
      body: {
        model: TTS_MODEL,
        contents: [{ role: "user", parts: [{ text: `${style}\n\nSay this: ${text}` }] }],
        generationConfig,
      },
    },
    {
      name: "gemini-plain",
      body: {
        model: TTS_MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig,
      },
    },
    {
      name: "gemini-interactions",
      body: {
        model: TTS_MODEL,
        input: [
          {
            type: "user_input",
            content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }],
          },
        ],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: voiceName }] },
      },
    },
    {
      name: "openai",
      body: {
        model: "openai/gpt-4o-mini-tts",
        input: text,
        voice: voice === "bigbrother" ? "ash" : voice === "storyteller" ? "sage" : "coral",
        instructions: style,
        response_format: "mp3",
      },
    },
  ];
}

let workingAttempt: string | null = null;

export const speakText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data }) => {
    const key = gatewayKey();
    const all = speechAttempts(data.text, data.voice, data.accent);
    const ordered = workingAttempt
      ? [...all.filter((a) => a.name === workingAttempt), ...all.filter((a) => a.name !== workingAttempt)]
      : all;

    const errors: string[] = [];
    for (const attempt of ordered) {
      const response = await fetch(`${GATEWAY}/audio/speech`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify(attempt.body),
      });
      if (response.ok) {
        try {
          const audio = await toPlayable(response);
          workingAttempt = attempt.name;
          return audio;
        } catch (error) {
          errors.push(`${attempt.name}: ${error instanceof Error ? error.message : "no audio"}`);
          continue;
        }
      }
      const failure = await gatewayError(response, "Speech");
      if (response.status === 402 || response.status === 429) throw failure;
      errors.push(`${attempt.name}: ${failure.message.replace(/^Speech failed /, "").slice(0, 160)}`);
    }
    throw new Error(`Speech failed. ${errors.join(" | ")}`);
  });

const SingInput = z.object({
  lyrics: z.string().min(1).max(600),
  title: z.string().max(120).optional(),
  style: z.enum(SONG_STYLE_IDS).optional(),
});

export const singRhyme = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SingInput.parse(input))
  .handler(async ({ data }) => {
    const key = gatewayKey();
    const long = isLongSong(data.lyrics);
    const style = data.style
      ? songStyleById(data.style).prompt
      : "A cheerful, simple, catchy children's song at a slow tempo with light acoustic backing";
    const prompt = [
      `${style}.`,
      "Clear, friendly, slowly sung vocals that sing these exact lyrics so every word is easy to hear, in English. Do not add other words.",
      long
        ? "Sing every line once, then repeat the lyrics as a chorus. Around 60 to 90 seconds long."
        : "Sing every line, then repeat them once if there is time.",
      data.title ? `Song title: ${data.title}` : "",
      "Lyrics:",
      data.lyrics,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(`${GATEWAY}/music`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        model: long ? MUSIC_MODEL_LONG : MUSIC_MODEL,
        input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
      }),
    });
    if (!response.ok) throw await gatewayError(response, "Song");
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("json")) {
      const found = findAudio(await response.json());
      if (!found) throw new Error("Song failed: no audio in the response");
      return { audioBase64: found.data, mimeType: "audio/mpeg" };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { audioBase64: toBase64(bytes), mimeType: "audio/mpeg" };
  });

/* ---------------- Songs to a chosen tune ---------------- */

/**
 * Tunes learners can pick. Classic tunes are traditional and free to use;
 * styles ask the AI for a brand-new melody. Copyrighted songs are never offered.
 */
export const TUNES = {
  "style:pop": { label: "Cheerful pop", music: "a cheerful, catchy children's pop song with light acoustic guitar and claps, slow-medium tempo" },
  "style:afrobeats": { label: "Afrobeats groove", music: "a bright, friendly afrobeats groove with log drums and shakers, relaxed tempo, clear sung vocals" },
  "style:lullaby": { label: "Gentle lullaby", music: "a calm, gentle lullaby with soft piano, slow tempo" },
  "style:rap": { label: "Rap with a beat", music: "a friendly kids' rap over a simple head-nod hip-hop beat, slow and very clear delivery" },
  "style:chant": { label: "Marching chant", music: "a call-and-response marching chant with a steady drum, very clear voice" },
  "classic:twinkle": { label: "Twinkle Twinkle Little Star", music: "sung to the traditional melody of 'Twinkle, Twinkle, Little Star' (public domain), simple piano accompaniment" },
  "classic:oldmacdonald": { label: "Old MacDonald Had a Farm", music: "sung to the traditional melody of 'Old MacDonald Had a Farm' (public domain), bouncy acoustic accompaniment" },
  "classic:rowrow": { label: "Row, Row, Row Your Boat", music: "sung to the traditional melody of 'Row, Row, Row Your Boat' (public domain), gentle accompaniment" },
  "classic:mary": { label: "Mary Had a Little Lamb", music: "sung to the traditional melody of 'Mary Had a Little Lamb' (public domain), simple accompaniment" },
  "classic:londonbridge": { label: "London Bridge Is Falling Down", music: "sung to the traditional melody of 'London Bridge Is Falling Down' (public domain), playful accompaniment" },
  "classic:frerejacques": { label: "Fr\u00e8re Jacques", music: "sung to the traditional melody of 'Fr\u00e8re Jacques' (public domain), light accompaniment" },
  "classic:yankeedoodle": { label: "Yankee Doodle", music: "sung to the traditional melody of 'Yankee Doodle' (public domain), lively fife-and-drum feel" },
  "own:chant": { label: "My own music (spoken over it)", music: "" },
} as const;

export type TuneId = keyof typeof TUNES;
const TUNE_IDS = Object.keys(TUNES) as [TuneId, ...TuneId[]];

const LyricsSchema = z.object({
  lines: z.array(z.string()).describe("4 to 8 short song lines"),
});

async function fitLyricsTo(facts: string, tune: TuneId, accent: Accent) {
  const guide =
    tune === "own:chant"
      ? "Write 4 to 8 short, punchy lines meant to be spoken rhythmically over a music track, one fact per line, each line 4 to 8 words."
      : tune.startsWith("classic:")
        ? `Rewrite the facts as new lyrics that fit the rhythm and syllable count of the traditional song "${TUNES[tune].label}", line by line, so they can be sung to that melody. Do not reuse the original words.`
        : `Write lyrics for ${TUNES[tune].label.toLowerCase()} style: 4 to 8 short lines with a simple rhyme and a repeating hook.`;
  const result = streamText({
    model: createResponsesModel(),
    system:
      `You write memory songs for a dyslexic learner aged 9 to 14. Keep every fact exactly right and in order. Never add facts. Common words, short lines, easy to sing. The whole song must be under 30 seconds. ${localeGuide(accent)}`,
    messages: [{ role: "user", content: `${guide}\n\nFacts to put in the song:\n${facts}` }],
    output: Output.object({ schema: LyricsSchema }),
    providerOptions: responsesProviderOptions,
  });
  const output = await result.output;
  const lines = (output?.lines ?? []).map((l) => l.trim()).filter(Boolean).slice(0, 8);
  if (lines.length === 0) throw new Error("Song failed: no lyrics came back");
  return lines;
}

const FitInput = z.object({
  facts: z.string().min(1).max(1500),
  tune: z.enum(TUNE_IDS),
  accent: z.enum(["ng", "intl"]).default("ng"),
});

/** Lyrics only, for speaking over the learner's own music. */
export const fitLyrics = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FitInput.parse(input))
  .handler(async ({ data }) => ({ lines: await fitLyricsTo(data.facts, data.tune, data.accent) }));

const SongInput = z.object({
  facts: z.string().min(1).max(1500),
  tune: z.enum(TUNE_IDS),
  title: z.string().max(120).optional(),
  accent: z.enum(["ng", "intl"]).default("ng"),
});

/** A sung memory song: lyrics fitted to the tune, then sung by the music model. */
export const makeSong = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SongInput.parse(input))
  .handler(async ({ data }) => {
    if (data.tune === "own:chant") throw new Error("Use your own music on this device instead");
    const lines = await fitLyricsTo(data.facts, data.tune, data.accent);
    const key = gatewayKey();
    const prompt = [
      `A children's memory song: ${TUNES[data.tune].music}.`,
      data.accent === "ng"
        ? "Sung by a warm, friendly Nigerian voice with natural Nigerian English pronunciation."
        : "Sung by a warm, friendly voice.",
      "Clear, friendly sung vocals that sing these exact lyrics, in order, so every word is easy to hear. Do not add other words.",
      data.title ? `Song title: ${data.title}` : "",
      "Lyrics:",
      lines.join("\n"),
    ]
      .filter(Boolean)
      .join("\n");
    const response = await fetch(`${GATEWAY}/music`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        model: MUSIC_MODEL,
        input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
      }),
    });
    if (!response.ok) throw await gatewayError(response, "Song");
    const type = response.headers.get("content-type") ?? "";
    let audioBase64: string;
    if (type.includes("json")) {
      const found = findAudio(await response.json());
      if (!found) throw new Error("Song failed: no audio in the response");
      audioBase64 = found.data;
    } else {
      audioBase64 = toBase64(new Uint8Array(await response.arrayBuffer()));
    }
    return { audioBase64, mimeType: "audio/mpeg", lines };
  });
