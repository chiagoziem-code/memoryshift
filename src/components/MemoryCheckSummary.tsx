import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { loadChecks, summariseArm, type ArmSummary, type RecallCheck } from "@/lib/recall";

function pct(value: number | null) {
  return value === null ? "–" : `${value}%`;
}

function ArmCard({ title, summary }: { title: string; summary: ArmSummary }) {
  return (
    <Card className="border-2">
      <CardContent className="space-y-3 pt-6">
        <p className="text-base font-semibold">{title}</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-secondary/60 px-2 py-3">
            <p className="text-sm text-muted-foreground">Before</p>
            <p className="text-2xl font-semibold">{pct(summary.before)}</p>
          </div>
          <div className="rounded-xl bg-secondary/60 px-2 py-3">
            <p className="text-sm text-muted-foreground">Next day</p>
            <p className="text-2xl font-semibold">{pct(summary.nextDay)}</p>
          </div>
          <div className="rounded-xl bg-primary/10 px-2 py-3">
            <p className="text-sm text-muted-foreground">Gain</p>
            <p className="text-2xl font-semibold">
              {summary.gain === null ? "–" : `${summary.gain > 0 ? "+" : ""}${summary.gain} pts`}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.sets} topic{summary.sets === 1 ? "" : "s"} with a before and next-day check
        </p>
      </CardContent>
    </Card>
  );
}

/** Before vs next-day recall, split by study method when pilot data exists. */
export function MemoryCheckSummary() {
  const [checks, setChecks] = useState<RecallCheck[]>([]);
  useEffect(() => setChecks(loadChecks()), []);

  const aids = summariseArm(checks, "aids");
  const plain = summariseArm(checks, "plain");
  const hasPilot = checks.some((c) => c.arm === "plain");

  return (
    <section className="space-y-5" data-testid="memory-check-summary">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <BrainCircuit className="size-6 text-primary" /> What really stuck
      </h2>
      <p className="text-lg text-muted-foreground">
        Average memory-check scores before studying and one day later.
      </p>
      {aids.sets === 0 && plain.sets === 0 ? (
        <p className="text-lg">
          No next-day checks yet.{" "}
          <Link to="/check" className="font-semibold underline">
            See your memory checks
          </Link>
        </p>
      ) : (
        <div className={`grid gap-4 ${hasPilot ? "sm:grid-cols-2" : ""}`}>
          <ArmCard title="With memory aids" summary={aids} />
          {hasPilot && <ArmCard title="Plain notes (pilot)" summary={plain} />}
        </div>
      )}
    </section>
  );
}
