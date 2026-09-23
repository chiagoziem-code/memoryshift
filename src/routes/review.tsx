import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Minus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { ReadAloud } from "@/components/ReadAloud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useA11y } from "@/lib/a11y";
import {
  BOX_GAPS_DAYS,
  dueItems,
  formatById,
  gradeItem,
  loadLibrary,
  loadProfile,
  recordFeedback,
  saveProfile,
  updateLibraryItem,
  type Confidence,
  type SavedMnemonic,
} from "@/lib/mnemonics";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review mode — MemoryShift" },
      {
        name: "description",
        content:
          "Practise your memory aids with spaced repetition, read-aloud support, adjustable text and simple confidence ratings.",
      },
      { property: "og:title", content: "Review mode — MemoryShift" },
      {
        property: "og:description",
        content: "One card at a time, read aloud, at the text size and spacing that suits you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

const CONFIDENCE: { id: Confidence; label: string; help: string; icon: typeof X }[] = [
  { id: "again", label: "Not yet", help: "Show me again today", icon: X },
  { id: "unsure", label: "Almost", help: "Come back tomorrow", icon: Minus },
  { id: "solid", label: "Got it", help: "Wait longer next time", icon: CheckCircle2 },
];

function itemText(item: SavedMnemonic) {
  return [item.title, item.body, ...item.steps, item.practiceTip].filter(Boolean).join(". ");
}

function ReviewPage() {
  const { settings, update } = useA11y();
  const [queue, setQueue] = useState<SavedMnemonic[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    setQueue(dueItems(loadLibrary()));
  }, []);

  const current = queue?.[index] ?? null;
  const total = queue?.length ?? 0;
  const progress = useMemo(() => (total === 0 ? 0 : (done / total) * 100), [done, total]);

  function grade(confidence: Confidence) {
    if (!current) return;
    updateLibraryItem(current.id, (item) => gradeItem(item, confidence));
    if (confidence !== "again") {
      const profile = loadProfile();
      saveProfile(
        recordFeedback(profile, current.format, confidence === "solid"),
      );
    }
    const gap = BOX_GAPS_DAYS[gradeItem(current, confidence).box ?? 0] ?? 1;
    toast.success(
      confidence === "again" ? "We'll show this again today" : `Next time in about ${gap} day(s)`,
    );
    setDone((d) => d + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 space-y-7">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Review</h1>
          <p className="text-lg text-muted-foreground">
            One card at a time. Try to say it from memory first, then check.
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">Make it comfortable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base">Text size</Label>
              <Slider
                value={[settings.fontSize]}
                min={16}
                max={30}
                step={1}
                onValueChange={([value]) => update({ fontSize: value ?? 18 })}
                aria-label="Text size"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Space between lines</Label>
              <Slider
                value={[settings.lineHeight * 10]}
                min={14}
                max={26}
                step={1}
                onValueChange={([value]) => update({ lineHeight: (value ?? 17) / 10 })}
                aria-label="Space between lines"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Reading speed for read-aloud</Label>
              <Slider
                value={[settings.speechRate * 100]}
                min={50}
                max={150}
                step={5}
                onValueChange={([value]) => update({ speechRate: (value ?? 90) / 100 })}
                aria-label="Reading speed"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ruler" className="text-base">
                Highlight one line at a time
              </Label>
              <Switch
                id="ruler"
                checked={settings.readingRuler}
                onCheckedChange={(checked) => update({ readingRuler: checked })}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              More choices live on the{" "}
              <Link to="/settings" className="font-semibold underline">
                reading &amp; access
              </Link>{" "}
              page.
            </p>
          </CardContent>
        </Card>

        {queue === null && <p className="text-lg text-muted-foreground">Loading your cards…</p>}

        {queue !== null && total === 0 && (
          <Card className="border-2">
            <CardContent className="space-y-4 pt-6 text-lg">
              <p>Nothing is due right now. Nice work.</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/studio">Make a new memory aid</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {queue !== null && total > 0 && !current && (
          <Card className="border-2 border-primary/50">
            <CardContent className="space-y-4 pt-6 text-lg">
              <p className="text-2xl font-semibold">Review finished 🎉</p>
              <p>You went through {done} card(s). They are scheduled for their next turn.</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => {
                    setQueue(dueItems(loadLibrary()));
                    setIndex(0);
                    setDone(0);
                  }}
                >
                  <RotateCcw className="mr-2 size-4" /> Check for more
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {current && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-base font-semibold text-muted-foreground">
                Card {index + 1} of {total}
              </p>
              <Progress value={progress} className="h-3" />
            </div>

            <Card className="border-2">
              <CardHeader className="gap-2">
                <p className="text-sm font-semibold text-primary">
                  <span aria-hidden className="mr-1">
                    {formatById(current.format).emoji}
                  </span>
                  {formatById(current.format).name} · {current.sourceLabel}
                </p>
                <CardTitle className="text-3xl leading-snug">{current.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!revealed ? (
                  <div className="space-y-4">
                    <p className="text-lg text-muted-foreground">
                      Say it out loud from memory, then reveal.
                    </p>
                    <Button size="lg" className="text-lg" onClick={() => setRevealed(true)}>
                      Show the memory aid <ChevronRight className="ml-2 size-5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-xl">{current.body}</p>
                    {current.steps.length > 0 && (
                      <ol className="space-y-2 text-lg">
                        {current.steps.map((step, i) => (
                          <li
                            key={i}
                            className={`rounded-xl px-4 py-3 ${
                              settings.readingRuler
                                ? "bg-accent/20 hover:bg-accent/45"
                                : "bg-secondary/60"
                            }`}
                          >
                            <span className="mr-3 font-semibold text-primary">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    )}
                    {current.practiceTip && (
                      <p className="rounded-xl bg-accent/30 px-4 py-3 text-base">
                        <span className="font-semibold">Practise: </span>
                        {current.practiceTip}
                      </p>
                    )}
                    <ReadAloud text={itemText(current)} />
                    <div className="space-y-3 pt-2">
                      <p className="text-lg font-semibold">How did that feel?</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {CONFIDENCE.map(({ id, label, help, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => grade(id)}
                            className="rounded-2xl border-2 border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary hover:bg-secondary"
                          >
                            <span className="flex items-center gap-2 text-base font-semibold">
                              <Icon className="size-5 text-primary" />
                              {label}
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">{help}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
