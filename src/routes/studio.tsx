import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Sigma,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { MnemonicCard } from "@/components/MnemonicCard";
import { ReadAloud } from "@/components/ReadAloud";
import { RecallQuiz, scoreMessage } from "@/components/RecallQuiz";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateMnemonics,
  makeRecallQuestions,
  readImageText,
  transcribeMedia,
} from "@/lib/mnemonics.functions";
import {
  addAttempt,
  attemptFor,
  loadChecks,
  loadPilot,
  pickArm,
  upsertCheck,
  type RecallCheck,
  type RecallStage,
} from "@/lib/recall";
import { loadActiveLearner, syncCheckInBackground } from "@/lib/sync";
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
  component: Studio,
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

/** Pull the sound out of a video in the browser and pack it as a WAV file. */
async function videoToWavDataUrl(file: File): Promise<string> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  const audio = await ctx.decodeAudioData(await file.arrayBuffer());
  void ctx.close();
  const samples = audio.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return readFile(new File([buffer], "audio.wav", { type: "audio/wav" }));
}

function Studio() {
  const generate = useServerFn(generateMnemonics);
  const transcribe = useServerFn(transcribeMedia);
  const readPictures = useServerFn(readImageText);
  const makeQuestions = useServerFn(makeRecallQuestions);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<Attachment[]>([]);
  const [mediaLabels, setMediaLabels] = useState<string[]>([]);
  const [isFormula, setIsFormula] = useState(false);
  const [busy, setBusy] = useState<"idle" | "transcribing" | "generating">("idle");

  const [selected, setSelected] = useState<FormatId[]>([]);
  const [results, setResults] = useState<SavedMnemonic[]>([]);

  /** Memory check flow: quiz before studying, study, quiz right after. */
  const [checkOn, setCheckOn] = useState(true);
  const [check, setCheck] = useState<RecallCheck | null>(null);
  const [phase, setPhase] = useState<"edit" | "before" | "study" | "now" | "done">("edit");

  function finishStage(stage: RecallStage, answers: number[]) {
    if (!check) return;
    const next = addAttempt(check, stage, answers);
    setCheck(next);
    upsertCheck(next);
    syncCheckInBackground(next);
    setPhase(stage === "before" ? "study" : "done");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
    if (picked.length === 0) return;
    setBusy("transcribing");
    try {
      const { text: words } = await readPictures({
        data: {
          isFormula,
          images: picked.map(({ mediaType, dataUrl }) => ({ mediaType, dataUrl })),
        },
      });
      if (words.trim()) {
        setText((current) => (current ? `${current}\n\n${words}` : words));
        setMediaLabels((current) => [...current, ...picked.map((p) => p.name)]);
        toast.success("Picture words written out — check them below");
      }
    } catch (error) {
      toast.error(error instanceof Error ? `We couldn't read that picture. ${error.message}` : "We couldn't read that picture.");
    } finally {
      setBusy("idle");
    }
  }

  async function onMedia(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, 3);
    if (picked.length === 0) return;
    setBusy("transcribing");
    try {
      for (const file of picked) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is too large (8 MB max)`);
          continue;
        }
        let dataUrl: string;
        let mediaType = file.type || "audio/mpeg";
        let fileName = file.name;
        if (mediaType.startsWith("video/")) {
          dataUrl = await videoToWavDataUrl(file);
          mediaType = "audio/wav";
          fileName = file.name.replace(/\.[^.]+$/, "") + ".wav";
        } else {
          dataUrl = await readFile(file);
        }
        const { text: transcript } = await transcribe({
          data: { mediaType, dataUrl, fileName },
        });
        if (!transcript.trim()) {
          toast.error(`No speech found in ${file.name}`);
          continue;
        }
        setText((current) => (current ? `${current}\n\n${transcript}` : transcript));
        setMediaLabels((current) => [...current, file.name]);
      }
      toast.success("Recording written out — you can edit the words below");
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
      const inputHints = [
        notes,
        isFormula
          ? "The attached images show maths or a formula: read every symbol carefully and keep the steps in order."
          : "",
        mediaLabels.length > 0
          ? "Some of the text came from a recording, so wording may be rough."
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      const imageData = images.map(({ mediaType, dataUrl }) => ({ mediaType, dataUrl }));
      const [output, recall] = await Promise.all([
        generate({
          data: {
            text,
            notes: inputHints,
            formats: selected,
            readingLevel: profile?.readingLevel ?? "simple",
            images: imageData,
          },
        }),
        checkOn
          ? makeQuestions({ data: { text, images: imageData } }).catch(() => ({ questions: [] }))
          : Promise.resolve({ questions: [] }),
      ]);

      const setId = `set-${Date.now()}`;
      const created: SavedMnemonic[] = (output?.items ?? []).map((item, i) => ({
        id: `${setId}-${i}`,
        setId,
        format: item.format as FormatId,
        title: item.title,
        body: item.body,
        steps: item.steps ?? [],
        practiceTip: item.practiceTip ?? "",
        sourceLabel: output?.subject ?? "My material",
        createdAt: new Date().toISOString(),
        liked: null,
        favourite: false,
        box: 0,
        dueAt: new Date().toISOString(),
        reviews: 0,
      }));
      setResults(created);

      if (recall.questions.length > 0) {
        const activeLearner = loadActiveLearner();
        const arm = loadPilot() ? pickArm(loadChecks()) : "aids";
        const newCheck: RecallCheck = {
          setId,
          subject: output?.subject ?? "My material",
          material: text,
          arm,
          formats: created.map((c) => c.format),
          ...(activeLearner ? { learnerId: activeLearner.id } : {}),
          questions: recall.questions,
          attempts: [],
          createdAt: new Date().toISOString(),
          ...(arm === "plain" ? { heldBack: created } : {}),
        };
        upsertCheck(newCheck);
        syncCheckInBackground(newCheck);
        setCheck(newCheck);
        // Plain-notes sets get their memory aids after the next-day check.
        if (arm === "aids") saveLibrary([...created, ...loadLibrary()]);
        setPhase("before");
      } else {
        setCheck(null);
        saveLibrary([...created, ...loadLibrary()]);
        setPhase("study");
      }
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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

        {phase !== "edit" && (
          <StudyFlow
            phase={phase}
            check={check}
            results={results}
            material={text}
            onFinish={finishStage}
            onCheckNow={() => setPhase("now")}
            onFeedback={onFeedback}
            onStartOver={() => {
              setPhase("edit");
              setResults([]);
              setCheck(null);
              setText("");
              setImages([]);
              setMediaLabels([]);
              setNotes("");
            }}
          />
        )}

        {phase === "edit" && (
        <>
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
                  <ImageIcon className="mr-2 inline size-4" /> Photos, pages or formulas
                </Label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void onImages(event.target.files)}
                />
                <p className="text-sm text-muted-foreground">
                  A page from a book, a whiteboard, a handwritten equation. Up to 3.
                </p>
                <button
                  type="button"
                  aria-pressed={isFormula}
                  onClick={() => setIsFormula((v) => !v)}
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                    isFormula ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Sigma className="mr-2 inline size-4" />
                  {isFormula ? "Reading these as maths" : "These are maths or formulas"}
                </button>
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
                  multiple
                  onChange={(event) => void onMedia(event.target.files)}
                  disabled={busy !== "idle"}
                />
                <p className="text-sm text-muted-foreground">
                  A lesson recording, a voice note, a video. We write out what is said.
                </p>
              </div>
            </div>

            {busy === "transcribing" && (
              <p className="flex items-center gap-2 text-base">
                <Loader2 className="size-4 animate-spin" /> Listening to your recording…
              </p>
            )}

            {mediaLabels.length > 0 && (
              <div className="space-y-2 rounded-xl bg-secondary px-4 py-3 text-base">
                <p className="font-semibold">Words added from:</p>
                <ul className="space-y-1">
                  {mediaLabels.map((label, index) => (
                    <li key={label + index} className="flex items-center justify-between gap-3">
                      <span>{label}</span>
                      <button
                        type="button"
                        aria-label={`Forget ${label}`}
                        onClick={() =>
                          setMediaLabels((current) => current.filter((_, i) => i !== index))
                        }
                        className="rounded-lg p-1 hover:bg-card"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  You can fix any wrong words in the box above before we start.
                </p>
              </div>
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
            <label className="flex items-start justify-between gap-4 rounded-2xl border-2 border-border bg-card px-4 py-4">
              <span>
                <span className="flex items-center gap-2 text-base font-semibold">
                  <BrainCircuit className="size-5 text-primary" /> Memory check
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  4 quick questions before and after, then again tomorrow, so you can see
                  what sticks.
                </span>
              </span>
              <Switch checked={checkOn} onCheckedChange={setCheckOn} aria-label="Memory check" />
            </label>
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

        </>
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

function StudyFlow({
  phase,
  check,
  results,
  material,
  onFinish,
  onCheckNow,
  onFeedback,
  onStartOver,
}: {
  phase: "before" | "study" | "now" | "done" | "edit";
  check: RecallCheck | null;
  results: SavedMnemonic[];
  material: string;
  onFinish: (stage: RecallStage, answers: number[]) => void;
  onCheckNow: () => void;
  onFeedback: (item: SavedMnemonic, liked: boolean) => void;
  onStartOver: () => void;
}) {
  if (phase === "before" && check) {
    return (
      <RecallQuiz
        key="before"
        title="Before you start"
        intro={"What do you already know? It's fine to say \"I don't know yet\". Most people don't!"}
        questions={check.questions}
        onDone={(answers) => onFinish("before", answers)}
      />
    );
  }
  if (phase === "now" && check) {
    return (
      <RecallQuiz
        key="now"
        title="Check yourself"
        intro="Same questions as before. Let's see what stuck."
        questions={check.questions}
        onDone={(answers) => onFinish("now", answers)}
      />
    );
  }

  const plain = check?.arm === "plain";
  const now = check ? attemptFor(check, "now") : null;

  return (
    <section className="space-y-5">
      {phase === "done" && now && (
        <Card className="border-2 border-primary/50" data-testid="check-result">
          <CardContent className="space-y-3 pt-6 text-lg">
            <p className="text-2xl font-semibold">{scoreMessage(now.correct, now.total)}</p>
            <p className="flex items-start gap-2 text-base text-muted-foreground">
              <CalendarClock className="mt-1 size-5 shrink-0" />
              Come back tomorrow for your next-day check. That's the one that shows what
              really stuck.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg">
                <Link to="/check">See my memory checks</Link>
              </Button>
              <Button size="lg" variant="outline" onClick={onStartOver}>
                Learn something new
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {plain ? (
        <Card className="border-2" data-testid="plain-notes">
          <CardHeader className="gap-2">
            <p className="text-sm font-semibold text-primary">Pilot study: plain notes</p>
            <CardTitle className="text-2xl">Study your notes</CardTitle>
            <p className="text-base text-muted-foreground">
              This time you'll learn from your notes the usual way. Your memory aids for
              this one unlock after tomorrow's check.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-lg">
            <ReadAloud text={material} />
            <p className="whitespace-pre-line rounded-xl bg-secondary/60 px-4 py-3">{material}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <h2 className="text-2xl font-semibold">Your memory aids</h2>
          {results.map((item) => (
            <MnemonicCard key={item.id} item={item} onFeedback={(liked) => onFeedback(item, liked)} />
          ))}
        </>
      )}

      {phase === "study" && (
        <Card className="border-2">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <p className="text-lg">
              {check
                ? "Take your time. When you feel ready, check yourself."
                : "Saved to your library."}
            </p>
            {check ? (
              <Button size="lg" onClick={onCheckNow}>
                <BrainCircuit className="mr-2 size-5" /> I'm ready, check me
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={onStartOver}>
                Learn something new
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
