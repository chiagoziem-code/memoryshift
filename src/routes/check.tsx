import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrainCircuit, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { RecallQuiz, scoreMessage } from "@/components/RecallQuiz";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadLibrary, saveLibrary } from "@/lib/mnemonics";
import {
  NEXT_DAY_HOURS,
  STAGE_LABEL,
  addAttempt,
  attemptFor,
  hoursSince,
  loadChecks,
  nextDayDue,
  nextDayWaiting,
  percent,
  upsertCheck,
  type RecallCheck,
  type RecallStage,
} from "@/lib/recall";
import { loadActiveLearner, syncCheckInBackground, type Learner } from "@/lib/sync";

export const Route = createFileRoute("/check")({
  head: () => ({
    meta: [
      { title: "Memory checks — MemoryShift" },
      {
        name: "description",
        content: "Quick next-day questions that show how much of what you learned really stuck.",
      },
    ],
  }),
  component: CheckPage,
});

function CheckPage() {
  const [checks, setChecks] = useState<RecallCheck[] | null>(null);
  const [active, setActive] = useState<RecallCheck | null>(null);
  const [lastResult, setLastResult] = useState<{ correct: number; total: number } | null>(null);

  const [learner, setLearner] = useState<Learner | null>(null);

  useEffect(() => {
    const active = loadActiveLearner();
    setLearner(active);
    setChecks(
      loadChecks().filter((c) => !active || !c.learnerId || c.learnerId === active.id),
    );
  }, []);

  function finish(check: RecallCheck, answers: number[]) {
    const next = addAttempt(check, "nextDay", answers);
    upsertCheck(next);
    syncCheckInBackground(next);
    const attempt = attemptFor(next, "nextDay")!;
    if (next.arm === "plain" && next.heldBack?.length) {
      saveLibrary([...next.heldBack, ...loadLibrary()]);
      upsertCheck({ ...next, heldBack: [] });
      toast.success("Your memory aids for this one are now in your library");
    }
    setLastResult({ correct: attempt.correct, total: attempt.total });
    setActive(null);
    setChecks(
      loadChecks().filter((c) => !learner || !c.learnerId || c.learnerId === learner.id),
    );
  }

  if (checks === null) return <div className="min-h-screen"><AppNav /></div>;

  const due = nextDayDue(checks);
  const waiting = nextDayWaiting(checks);
  const finished = checks.filter((c) => attemptFor(c, "nextDay"));

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-4xl space-y-8 px-5 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Memory checks</h1>
          <p className="text-lg text-muted-foreground">
            The next-day check shows what really stuck. Same questions, one day later.
          </p>
          {learner ? (
            <p className="text-base">
              Learner: <span className="font-semibold">{learner.nickname}</span>.{" "}
              <Link to="/account" className="underline">
                Switch
              </Link>
            </p>
          ) : (
            <p className="rounded-2xl border-2 border-accent bg-accent/25 px-5 py-4 text-base">
              Part of the pilot?{" "}
              <Link to="/account" className="font-semibold underline">
                Parents, sign in here
              </Link>{" "}
              so results are saved safely.
            </p>
          )}
        </div>

        {active ? (
          <RecallQuiz
            key={active.setId}
            title={`Next-day check: ${active.subject}`}
            intro="You saw these questions yesterday. Answer from memory, no peeking!"
            questions={active.questions}
            onDone={(answers) => finish(active, answers)}
          />
        ) : (
          <>
            {lastResult && (
              <Card className="border-2 border-primary/50">
                <CardContent className="pt-6 text-2xl font-semibold">
                  {scoreMessage(lastResult.correct, lastResult.total)}
                </CardContent>
              </Card>
            )}

            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-2xl font-semibold">
                <BrainCircuit className="size-6 text-primary" /> Ready now
              </h2>
              {due.length === 0 ? (
                <p className="text-lg text-muted-foreground">
                  Nothing to check right now.{" "}
                  {checks.length === 0 && (
                    <Link to="/studio" className="font-semibold underline">
                      Make a memory aid with a memory check
                    </Link>
                  )}
                </p>
              ) : (
                due.map((check) => (
                  <Card key={check.setId} className="border-2">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                      <div>
                        <p className="text-xl font-semibold">{check.subject}</p>
                        <p className="text-base text-muted-foreground">
                          {check.questions.length} questions
                        </p>
                      </div>
                      <Button size="lg" onClick={() => { setLastResult(null); setActive(check); }}>
                        Start check
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </section>

            {waiting.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-2xl font-semibold">
                  <CalendarClock className="size-6 text-primary" /> Coming tomorrow
                </h2>
                {waiting.map((check) => (
                  <Card key={check.setId} className="border-2">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                      <p className="text-xl font-semibold">{check.subject}</p>
                      <p className="text-base text-muted-foreground">
                        Ready in about{" "}
                        {Math.max(1, Math.ceil(NEXT_DAY_HOURS - hoursSince(check.createdAt)))}{" "}
                        hours
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            )}

            {finished.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-2xl font-semibold">
                  <CheckCircle2 className="size-6 text-primary" /> Done
                </h2>
                {finished.map((check) => (
                  <ScoreRow key={check.setId} check={check} />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export function ScoreRow({ check }: { check: RecallCheck }) {
  const stages: RecallStage[] = ["before", "now", "nextDay"];
  return (
    <Card className="border-2">
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-xl">{check.subject}</CardTitle>
        {check.arm === "plain" && (
          <p className="text-sm text-muted-foreground">Pilot: studied as plain notes</p>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        {stages.map((stage) => {
          const value = percent(attemptFor(check, stage));
          return (
            <div key={stage} className="rounded-xl bg-secondary/60 px-3 py-3 text-center">
              <p className="text-sm text-muted-foreground">{STAGE_LABEL[stage]}</p>
              <p className="text-2xl font-semibold">{value === null ? "–" : `${value}%`}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
