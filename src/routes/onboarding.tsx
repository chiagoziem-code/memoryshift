import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FORMATS,
  QUIZ,
  formatById,
  loadProfile,
  rankFormats,
  saveProfile,
  scoreQuiz,
  type FormatId,
} from "@/lib/mnemonics";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Calibration quiz — MemoryShift" },
      {
        name: "description",
        content:
          "Six quick questions that set your starting memory-aid profile, so MemoryShift suggests the formats most likely to work for you.",
      },
      { property: "og:title", content: "Calibration quiz — MemoryShift" },
      {
        property: "og:description",
        content: "Answer six questions and get a starting mnemonic profile you can refine later.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<FormatId[] | null>(null);

  const question = QUIZ[Math.min(step, QUIZ.length - 1)]!;
  const done = step >= QUIZ.length;

  function choose(index: number) {
    const next = { ...answers, [question.id]: index };
    setAnswers(next);
    if (step + 1 < QUIZ.length) {
      setStep(step + 1);
      return;
    }
    const scores = scoreQuiz(next);
    const profile = { ...loadProfile(), scores, calibrated: true };
    saveProfile(profile);
    setResult(rankFormats(profile).slice(0, 3));
    setStep(QUIZ.length);
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 space-y-8">
        {!done && (
          <>
            <div className="space-y-3">
              <p className="text-base font-semibold text-muted-foreground">
                Question {step + 1} of {QUIZ.length}
              </p>
              <Progress value={((step + 1) / QUIZ.length) * 100} className="h-3" />
            </div>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-3xl leading-snug">{question.question}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {question.options.map((option, index) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => choose(index)}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-border bg-background px-5 py-5 text-left text-lg font-medium transition-colors hover:border-primary hover:bg-secondary"
                  >
                    {option.label}
                    <ArrowRight className="size-5 shrink-0 text-primary" />
                  </button>
                ))}
              </CardContent>
            </Card>
            {step > 0 && (
              <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
            )}
          </>
        )}

        {done && result && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold">Your starting profile is ready</h1>
              <p className="text-lg text-muted-foreground">
                These three formats will show up first in the studio. Nothing is locked in — your
                thumbs up and thumbs down keep changing the order.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {result.map((id, i) => {
                const format = formatById(id);
                return (
                  <Card key={id} className="border-2 border-primary/40">
                    <CardHeader className="gap-1">
                      <p className="text-sm font-semibold text-primary">Match {i + 1}</p>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <span aria-hidden>{format.emoji}</span>
                        {format.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-base text-muted-foreground">
                      {format.tagline}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="rounded-2xl border-2 border-border bg-card p-6">
              <p className="mb-3 flex items-center gap-2 font-semibold">
                <Check className="size-5 text-primary" /> All {FORMATS.length} formats stay
                available
              </p>
              <p className="text-base text-muted-foreground">
                You can always pick a different one in the studio, or try a surprise suggestion.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="text-lg"
                onClick={() => navigate({ to: "/studio" })}
              >
                Go to the studio
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/profile">Fine-tune my profile</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
