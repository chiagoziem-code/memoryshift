import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ReadAloud } from "@/components/ReadAloud";
import { useA11y } from "@/lib/a11y";
import type { RecallQuestion } from "@/lib/recall";

export const DONT_KNOW = -1;

/**
 * One question at a time, big buttons, every question can be read aloud.
 * "I don't know yet" is always offered so learners don't feel pushed to guess.
 * No right/wrong feedback during the quiz, so the check itself doesn't teach.
 */
export function RecallQuiz({
  title,
  intro,
  questions,
  onDone,
}: {
  title: string;
  intro: string;
  questions: RecallQuestion[];
  onDone: (answers: number[]) => void;
}) {
  const { stopSpeaking } = useA11y();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const current = questions[index];

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  if (!current) return null;

  const spoken = [
    current.question,
    ...current.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`),
  ].join(". ");

  function choose(option: number) {
    stopSpeaking();
    const next = [...answers, option];
    if (next.length >= questions.length) {
      onDone(next);
      return;
    }
    setAnswers(next);
    setIndex(index + 1);
  }

  return (
    <Card className="border-2 border-primary/50" data-testid="recall-quiz">
      <CardHeader className="gap-2">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <CardTitle className="text-base font-normal text-muted-foreground">{intro}</CardTitle>
        <div className="flex items-center gap-3 pt-2">
          <Progress value={(index / questions.length) * 100} className="h-2" />
          <span className="shrink-0 text-sm text-muted-foreground">
            {index + 1} of {questions.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-2xl font-semibold leading-snug">{current.question}</p>
        <ReadAloud text={spoken} label="Read it to me" size="default" />
        <div className="grid gap-3">
          {current.options.map((option, i) => (
            <button
              key={option + i}
              type="button"
              onClick={() => choose(i)}
              className="flex items-center gap-4 rounded-2xl border-2 border-border bg-card px-5 py-4 text-left text-lg transition-colors hover:border-primary focus-visible:border-primary"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary font-semibold">
                {String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="justify-start text-base"
            onClick={() => choose(DONT_KNOW)}
          >
            <HelpCircle className="mr-2 size-5" /> I don't know yet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Friendly score line, never framed as failure. */
export function scoreMessage(correct: number, total: number) {
  if (total === 0) return "";
  if (correct === total) return `${correct} out of ${total}. You remembered all of it!`;
  if (correct === 0) return `0 out of ${total} this time. That's fine, this is what practice is for.`;
  return `${correct} out of ${total}. Nice, that's ${correct} more fact${correct === 1 ? "" : "s"} you can hold onto.`;
}
