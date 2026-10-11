import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Natural-voice speech and sung rhymes through the Lovable AI gateway.
 * Every caller in the app falls back to the device voice if these fail,
 * so a failure here never blocks learning.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TTS_MODEL = "google/gemini-2.5-flash-tts";
const MUSIC_MODEL = "google/lyria-3-clip-preview";

/** Two friendly Gemini prebuilt voices. */
const VOICES = { warm: "Sulafat", bright: "Puck" } as const;

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

/** Turn whatever the gateway sent back into a browser-playable file. */
async function toPlayable(response: Response) {
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    const found = findAudio(await response.json());
    if (!found) throw new Error("Speech failed: no audio in the response");
    const bytes = fromBase64(found.data);
    const mime = found.mimeType.toLowerCase();
    if (mime.includes("mpeg") || mime.includes("mp3")) return { audioBase64: found.data, mimeType: "audio/mpeg" };
    if (mime.includes("wav")) return { audioBase64: found.data, mimeType: "audio/wav" };
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
    return { audioBase64: toBase64(pcmToWav(bytes, rate)), mimeType: "audio/wav" };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (type.includes("pcm") || type.includes("l16")) {
    return { audioBase64: toBase64(pcmToWav(bytes)), mimeType: "audio/wav" };
  }
  return { audioBase64: toBase64(bytes), mimeType: type.startsWith("audio/") ? type.split(";")[0]! : "audio/mpeg" };
}

const SpeakInput = z.object({
  text: z.string().min(1).max(1500),
  voice: z.enum(["warm", "bright"]).default("warm"),
});

export const speakText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SpeakInput.parse(input))
  .handler(async ({ data }) => {
    const key = gatewayKey();
    const voiceName = VOICES[data.voice];
    const styled = `Read this slowly and clearly, in a warm, encouraging voice, like a kind tutor reading to a ten-year-old: ${data.text}`;

    // Gemini-style request first, then the OpenAI-style body the endpoint also accepts.
    const attempts = [
      {
        model: TTS_MODEL,
        contents: [{ parts: [{ text: styled }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      },
      {
        model: TTS_MODEL,
        input: data.text,
        voice: voiceName,
        instructions:
          "Speak slowly and clearly, warm and encouraging, like a kind tutor reading to a ten-year-old with dyslexia.",
        response_format: "mp3",
      },
    ];

    let lastError: Error | null = null;
    for (const body of attempts) {
      const response = await fetch(`${GATEWAY}/audio/speech`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify(body),
      });
      if (response.ok) return await toPlayable(response);
      lastError = await gatewayError(response, "Speech");
      if (response.status === 402 || response.status === 429) break;
    }
    throw lastError ?? new Error("Speech failed");
  });

const SingInput = z.object({
  lyrics: z.string().min(1).max(600),
  title: z.string().max(120).optional(),
});

export const singRhyme = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SingInput.parse(input))
  .handler(async ({ data }) => {
    const key = gatewayKey();
    const prompt = [
      "A cheerful, simple, catchy children's song at a slow tempo with light acoustic backing.",
      "Clear, friendly sung vocals that sing these exact lyrics so every word is easy to hear. Do not add other words.",
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
        model: MUSIC_MODEL,
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
