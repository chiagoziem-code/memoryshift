import { createServerFn } from "@tanstack/react-start";
import { Output, streamText } from "ai";
import { z } from "zod";
import { createResponsesModel, responsesProviderOptions } from "./ai-gateway.server";

const FORMAT_IDS = [
  "acronym",
  "rhyme",
  "story",
  "visual",
  "palace",
  "chunk",
  "sketch",
  "movement",
  "analogy",
] as const;

const GenerateInput = z.object({
  text: z.string().default(""),
  notes: z.string().default(""),
  formats: z.array(z.enum(FORMAT_IDS)).min(1).max(4),
  readingLevel: z.enum(["simple", "standard"]).default("simple"),
  images: z
    .array(z.object({ mediaType: z.string(), dataUrl: z.string() }))
    .max(3)
    .default([]),
});

const ResultSchema = z.object({
  subject: z.string().describe("Short label for what is being learned"),
  items: z.array(
    z.object({
      format: z.enum(FORMAT_IDS),
      title: z.string(),
      body: z.string().describe("The mnemonic itself, plain words, short lines"),
      steps: z.array(z.string()).describe("2-6 short steps or lines to remember"),
      practiceTip: z.string().describe("One sentence on how to rehearse it"),
    }),
  ),
});

const FORMAT_GUIDE: Record<(typeof FORMAT_IDS)[number], string> = {
  acronym: "a letter-based cue (acronym or acrostic sentence) that is easy to say aloud",
  rhyme: "a short rhyme or chant with a clear beat",
  story: "a linked silly story where each fact is an event in order",
  visual: "one vivid image described concretely so it can be pictured",
  palace: "facts placed at named spots in a familiar room, in walking order",
  chunk: "the material split into small labelled chunks with a visible pattern",
  sketch: "instructions for a simple doodle the learner draws themselves",
  movement: "a gesture or action per fact, described physically",
  analogy: "an everyday comparison that maps part by part onto the material",
};

export const generateMnemonics = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }) => {
    const readability =
      data.readingLevel === "simple"
        ? "Write for a dyslexic learner: short sentences, common words, one idea per line, no long paragraphs, no jargon."
        : "Write clearly and concisely for a confident reader, still using short lines.";

    const system = [
      "You create memory aids (mnemonics) for dyslexic learners.",
      readability,
      "Never invent facts that are not in the material. Keep spelling simple and phonetic where possible.",
      "Produce exactly one mnemonic per requested format.",
    ].join(" ");

    const requested = data.formats
      .map((f) => `- ${f}: ${FORMAT_GUIDE[f]}`)
      .join("\n");

    const parts: Array<
      { type: "text"; text: string } | { type: "file"; mediaType: string; data: string }
    > = [
      {
        type: "text",
        text: [
          "Material to learn:",
          data.text || "(see attached image)",
          data.notes ? `Learner notes: ${data.notes}` : "",
          "",
          "Create one mnemonic for each of these formats:",
          requested,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];

    for (const image of data.images) {
      parts.push({ type: "file", mediaType: image.mediaType, data: image.dataUrl });
    }

    const result = streamText({
      model: createResponsesModel(),
      system,
      messages: [{ role: "user", content: parts }],
      output: Output.object({ schema: ResultSchema }),
      providerOptions: responsesProviderOptions,
    });

    return await result.output;
  });

const TranscribeInput = z.object({
  mediaType: z.string(),
  dataUrl: z.string(),
  fileName: z.string().default("upload"),
});

export const transcribeMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TranscribeInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const base64 = data.dataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: data.mediaType }), data.fileName);
    form.append("model", "google/gemini-3.5-transcribe");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Transcription failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await response.json()) as { text?: string };
    return { text: json.text ?? "" };
  });
