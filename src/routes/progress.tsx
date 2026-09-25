import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Flame, LineChart, Sparkles, TrendingUp } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import {
  confidenceTrend,
  formatById,
  formatInsights,
  loadLibrary,
  loadReviewLog,
  reviewStreak,
  upcomingReviews,
  type ReviewEvent,
  type SavedMnemonic,
} from "@/lib/mnemonics";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "My progress — MemoryShift" },
      {
        name: "description",
        content:
          "See how your confidence is growing, what is coming up for review, and which kinds of memory aid help you most.",
      },
      { property: "og:title", content: "My progress — MemoryShift" },
      {
        property: "og:description",
        content: "Confidence over time, upcoming reviews and your best memory aid formats.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

const CONFIDENCE_WORD = (value: number) =>
  value >= 0.75 ? "Got it" : value >= 0.4 ? "Almost" : "Not yet";

function ProgressPage() {
  const [library, setLibrary] = useState<SavedMnemonic[] | null>(null);
  const [events, setEvents] = useState<ReviewEvent[]>([]);

  useEffect(() => {
    setLibrary(loadLibrary());
    setEvents(loadReviewLog());
  }, []);

  const trend = useMemo(() => confidenceTrend(events, 14), [events]);
  const upcoming = useMemo(() => upcomingReviews(library ?? []), [library]);
  const insights = useMemo(() => formatInsights(library ?? [], events), [library, events]);
  const streak = useMemo(() => reviewStreak(events), [events]);

  const solid = events.filter((e) => e.confidence === "solid").length;
  const overall = events.length === 0 ? 0 : solid / events.length;
  const best = insights.find((i) => i.reviews > 0) ?? insights[0] ?? null;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-10 space-y-12">
        <section className="space-y-4">
          <h1 className="text-3xl font-bold sm:text-4xl">Your progress</h1>
          <p className="text-lg text-muted-foreground">
            How your confidence is growing, what is next, and what works best for you.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-2 border-primary/40">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="size-5 text-primary" /> Said &ldquo;Got it&rdquo;
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-bold">{Math.round(overall * 100)}%</p>
                <p className="text-base text-muted-foreground">
                  From {events.length} practice{events.length === 1 ? "" : "s"} so far.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="size-5 text-primary" /> Days in a row
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-bold">{streak}</p>
                <p className="text-base text-muted-foreground">Practise today to keep it going.</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-5 text-primary" /> Works best
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xl font-semibold">
                  {best ? (
                    <>
                      <span aria-hidden className="mr-1">
                        {formatById(best.format).emoji}
                      </span>
                      {formatById(best.format).name}
                    </>
                  ) : (
                    "Not enough practice yet"
                  )}
                </p>
                <Button asChild variant="secondary">
                  <Link to="/review">Start reviewing</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <LineChart className="size-6 text-primary" /> Confidence over the last 2 weeks
          </h2>
          {events.length === 0 ? (
            <Card className="border-2">
              <CardContent className="space-y-4 pt-6 text-lg">
                <p>Once you review a few cards, your confidence will show up here.</p>
                <Button asChild size="lg">
                  <Link to="/studio">Make a memory aid</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-end gap-2" role="img" aria-label="Daily confidence chart">
                  {trend.map((point) => (
                    <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-32 w-full items-end rounded-lg bg-secondary/60">
                        <div
                          className="w-full rounded-lg bg-primary"
                          style={{ height: `${Math.max(point.confidence * 100, point.reviews ? 8 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{point.label}</span>
                    </div>
                  ))}
                </div>
                <ul className="mt-5 space-y-1 text-base">
                  {trend
                    .filter((point) => point.reviews > 0)
                    .slice(-4)
                    .reverse()
                    .map((point) => (
                      <li key={point.date}>
                        <span className="font-semibold">
                          {new Date(point.date).toLocaleDateString()}
                        </span>{" "}
                        — {point.reviews} card(s), mostly &ldquo;
                        {CONFIDENCE_WORD(point.confidence)}&rdquo;
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarClock className="size-6 text-primary" /> Coming up
          </h2>
          <div className="grid gap-4 sm:grid-cols-4">
            {upcoming.map((bucket) => (
              <Card key={bucket.key} className="border-2">
                <CardHeader className="gap-1">
                  <CardTitle className="text-base">{bucket.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{bucket.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {(upcoming[0]?.count ?? 0) > 0 && (
            <Button asChild size="lg">
              <Link to="/review">Review {upcoming[0]?.count} card(s) now</Link>
            </Button>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Which kinds help you most</h2>
          {insights.length === 0 && (
            <p className="text-lg text-muted-foreground">
              Make a few memory aids and practise them to see this.
            </p>
          )}
          <div className="space-y-4">
            {insights.map((insight) => (
              <Card key={insight.format} className="border-2">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold">
                      <span aria-hidden className="mr-2">
                        {formatById(insight.format).emoji}
                      </span>
                      {formatById(insight.format).name}
                    </p>
                    <p className="text-base text-muted-foreground">
                      {insight.cards} card(s) · {insight.reviews} practice(s)
                      {insight.reviews > 0 && ` · ${Math.round(insight.solidRate * 100)}% "Got it"`}
                    </p>
                  </div>
                  <ProgressBar value={Math.round(insight.confidence * 100)} />
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-base text-muted-foreground">
            Want to change what we suggest?{" "}
            <Link to="/profile" className="font-semibold underline">
              Adjust your profile
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
