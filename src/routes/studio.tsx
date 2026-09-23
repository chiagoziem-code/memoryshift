import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Mic, Sparkles, Video, X } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { MnemonicCard } from "@/components/MnemonicCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateMnemonics, transcribeMedia } from "@/lib/mnemonics.functions";
import {
  FORMATS,
  formatById,
  loadLibrary,
  loadProfile,
  rankFormats,
  recordFeedback,
  saveLibrary,
  saveProfile,
  type FormatId,
  type Profile,
  type SavedMnemonic,
} from "@/lib/mnemonics";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — make a memory aid | MemoryShift" },
      {
        name: "description",
        content:
          "Upload notes, photos, formulas, audio or video and turn them into rhymes, stories, pictures, doodle plans and other memory aids.",
      },
      { property: "og:title", content: "Studio — make a memory aid | MemoryShift" },
      {
        property: "og:description",
        content: "Bring in any material and choose the memory-aid formats you want back.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio;
});

type Attachment = { name: string; mediaType: string; dataUrl: string };

const MAX_BYTES = 8 * 1024 * 1024;

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function Studio() {
  const generate = useServerFn(generateMnemonics);
  const transcribe = useServerFn(transcribeMedia);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<Attachment[]>([]);
  const [mediaLabel, setMediaLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "transcribing" | "generating">("idle");
  const [selected, setSelected] = useState<FormatId[]>([]);
  const [results, setResults] = useState<SavedMnemonic[]>([]);

  useEffect(() => {
    const loaded = loadProfile();
    setProfile(loaded);
    setSelected(rankFormats(loaded).slice(0, 2));
  }, []);

  const ranked = useMemo(() => (profile ? rankFormats(profile) : FORMATS.map((f) => f.id)), [profile]);
  const recommended = ranked.slice(0, 3);
  const others = ranked.slice(3);

  function toggle(id: FormatId) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((f) => f !== id)
        : current.length >= 4
          ? current
          : [...current, id],
    );
  }

  async function onImages(files: FileList | null) {
    if (!files) return;
    const picked: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is too large (8 MB max)`);
        continue;
      }
      picked.push({ name: file.name, mediaType: file.type, dataUrl: await readFile(file) });
    }
    setImages((current) => [...current, ...picked].slice(0, 3));
  }

  async function onMedia(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("That recording is too large (8 MB max)");
      return;
    }
    setBusy("transcribing");
    try {
      const dataUrl = await readFile(file);
      const { text: transcript } = await transcribe({
        data: { mediaType: file.type || "audio/mpeg", dataUrl, fileName: file.name },
      });
      if (!transcript.trim()) throw new Error("No speech found in that file");
      setText((current) => (current ? `${current}\n\n${transcript}` : transcript));
      setMediaLabel(file.name);
      toast.success("Recording written out — check the text below");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `We couldn't listen to that file. ${error.message}`
          : "We couldn't listen to that file.",
      );
    } finally {
      setBusy("idle");
    }
  }

  async function onGenerate() {
    if (!text.trim() && images.length === 0) {
      toast.error("Add some text, or a photo, first");
      return;
    }
    if (selected.length === 0) {
      toast.error("Pick at least one kind of memory aid");
      return;
    }
    setBusy("generating");
    try {
      const output = await generate({
        data: {
          text,
          notes,
          formats: selected,
          readingLevel: profile?.readingLevel ?? "simple",
          images: images.map(({ mediaType, dataUrl }) => ({ mediaType, dataUrl })),
        },
      });
      const created: SavedMnemonic[] = (output?.items ?? []).map((item, i) => ({
        id: `${Date.now()}-${i}`,
        format: item.format as FormatId,
        title: item.title,
        body: item.body,
        steps: item.steps ?? [],
        practiceTip: item.practiceTip ?? "",
        sourceLabel: output?.subject ?? "My material",
        createdAt: new Date().toISOString(),
        liked: null,
      }));
      setResults(created);
      saveLibrary([...created, ...loadLibrary()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong making your memory aids",
      );
    } finally {
      setBusy("idle");
    }
  }

  function onFeedback(item: SavedMnemonic, liked: boolean) {
    setResults((current) =>
      current.map((r) => (r.id === item.id ? { ...r, liked } : r)),
    );
    saveLibrary(
      loadLibrary().map((r) => (r.id === item.id ? { ...r, liked } : r)),
    );
    if (profile) {
      const next = recordFeedback(profile, item.format, liked);
      setProfile(next);
      saveProfile(next);
      toast.success(
        liked
          ? `${formatById(item.format).name} will show up higher for you`
          : `We'll suggest ${formatById(item.format).name} less often`,
      );
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-4xl px-5 py-10 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Studio</h1>
          <p className="text-lg text-muted-foreground">
            Step 1: bring in what you need to learn. Step 2: choose the kinds of memory aid you
            want back.
          </p>
          {profile && !profile.calibrated && (
            <p className="rounded-2xl border-2 border-accent bg-accent/25 px-5 py-4 text-base">
              You haven’t done the short quiz yet, so these picks are just our general starters.{" "}
              <Link to="/onboarding" className="font-semibold underline">
                Take the quiz
              </Link>
            </p>
          )}
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">1. What are you learning?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="material" className="text-base">
                <FileText className="mr-2 inline size-4" /> Type or paste it
              </Label>
              <Textarea
                id="material"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={7}
                placeholder="Paste your notes, a list, a definition, or a formula written out…"
                className="text-lg leading-relaxed"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="photos" className="text-base">
                  <ImageIcon className="mr-2 inline size-4" /> Photos or formulas
                </Label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void onImages(event.target.files)}
                />
                <p className="text-sm text-muted-foreground">
                  A page from a book, a whiteboard, a handwritten equation.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="media" className="text-base">
                  <Mic className="mr-2 inline size-4" />
                  <Video className="mr-2 inline size-4" /> Audio or video
                </Label>
                <Input
                  id="media"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={(event) => void onMedia(event.target.files)}
                  disabled={busy !== "idle"}
                />
                <p className="text-sm text-muted-foreground">
                  We write out what is said, then work from that.
                </p>
              </div>
            </div>

            {busy === "transcribing" && (
              <p className="flex items-center gap-2 text-base">
                <Loader2 className="size-4 animate-spin" /> Listening to your recording…
              </p>
            )}

            {mediaLabel && (
              <p className="rounded-xl bg-secondary px-4 py-3 text-base">
                Added words from <span className="font-semibold">{mediaLabel}</span>
              </p>
            )}

            {images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {images.map((image, index) => (
                  <div key={image.name + index} className="relative">
                    <img
                      src={image.dataUrl}
                      alt={image.name}
                      className="size-28 rounded-xl border-2 border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${image.name}`}
                      onClick={() => setImages((c) => c.filter((_, i) => i !== index))}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base">
                Anything we should know? (optional)
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="It's for a test on Friday / I mix up the last two steps"
                className="text-lg"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">2. Which kinds of memory aid?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="font-semibold">Matched to you</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {recommended.map((id) => (
                  <FormatButton
                    key={id}
                    id={id}
                    selected={selected.includes(id)}
                    onClick={() => toggle(id)}
                    highlight
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="font-semibold">Other options</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {others.map((id) => (
                  <FormatButton
                    key={id}
                    id={id}
                    selected={selected.includes(id)}
                    onClick={() => toggle(id)}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Pick up to 4 at a time.</p>
            <Button
              size="lg"
              className="w-full text-lg"
              onClick={() => void onGenerate()}
              disabled={busy !== "idle"}
            >
              {busy === "generating" ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" /> Making your memory aids…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-5" /> Make my memory aids
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold">Your memory aids</h2>
            {results.map((item) => (
              <MnemonicCard
                key={item.id}
                item={item}
                onFeedback={(liked) => onFeedback(item, liked)}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function FormatButton({
  id,
  selected,
  onClick,
  highlight,
}: {
  id: FormatId;
  selected: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  const format = formatById(id);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-2xl border-2 px-4 py-4 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : highlight
            ? "border-accent bg-accent/15 hover:border-primary"
            : "border-border bg-card hover:border-primary"
      }`}
    >
      <span className="block text-base font-semibold">
        <span aria-hidden className="mr-2">
          {format.emoji}
        </span>
        {format.name}
      </span>
      <span className="mt-1 block text-sm text-muted-foreground">{format.tagline}</span>
    </button>
  );
}
