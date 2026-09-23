import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { ReadAloud } from "@/components/ReadAloud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { FONT_STACKS, useA11y, type ContrastChoice, type FontChoice } from "@/lib/a11y";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Reading & access settings — MemoryShift" },
      {
        name: "description",
        content:
          "Choose your font, text spacing, contrast, animation and read-aloud speed, and turn on reduced motion.",
      },
      { property: "og:title", content: "Reading & access settings — MemoryShift" },
      {
        property: "og:description",
        content: "Set up MemoryShift so reading and moving through it feels comfortable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const CONTRASTS: { id: ContrastChoice; label: string; help: string }[] = [
  { id: "cream", label: "Warm cream", help: "Softer than white, easier on the eyes" },
  { id: "white", label: "Plain white", help: "Crisp and familiar" },
  { id: "dark", label: "Dark", help: "Light text on a dark background" },
  { id: "high", label: "High contrast", help: "Strongest difference between text and page" },
];

const SAMPLE =
  "Every Cat Plays Catch. Evaporation, condensation, precipitation, collection. Say the cue, then say the words in order.";

function SettingsPage() {
  const { settings, update, reset } = useA11y();

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Reading &amp; access</h1>
          <p className="text-lg text-muted-foreground">
            Everything here changes the whole app straight away and is remembered on this device.
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Font</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(FONT_STACKS) as FontChoice[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={settings.font === id}
                onClick={() => update({ font: id })}
                style={{ fontFamily: FONT_STACKS[id].stack }}
                className={`rounded-2xl border-2 px-4 py-4 text-left text-lg transition-colors ${
                  settings.font === id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                <span className="block font-semibold">{FONT_STACKS[id].label}</span>
                <span className="mt-1 block text-base">Handy words to read</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Text size &amp; spacing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-7">
            <Control
              label={`Text size (${settings.fontSize}px)`}
              value={settings.fontSize}
              min={16}
              max={30}
              step={1}
              onChange={(value) => update({ fontSize: value })}
            />
            <Control
              label={`Space between lines (${settings.lineHeight.toFixed(1)})`}
              value={settings.lineHeight * 10}
              min={14}
              max={26}
              step={1}
              onChange={(value) => update({ lineHeight: value / 10 })}
            />
            <Control
              label="Space between letters"
              value={settings.letterSpacing * 1000}
              min={0}
              max={120}
              step={4}
              onChange={(value) => update({ letterSpacing: value / 1000 })}
            />
            <Control
              label="Space between words"
              value={settings.wordSpacing * 100}
              min={0}
              max={40}
              step={2}
              onChange={(value) => update({ wordSpacing: value / 100 })}
            />
            <div className="rounded-2xl border-2 border-border bg-card p-5">
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Preview</p>
              <p>{SAMPLE}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Colour &amp; contrast</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {CONTRASTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={settings.contrast === option.id}
                onClick={() => update({ contrast: option.id })}
                className={`rounded-2xl border-2 px-4 py-4 text-left transition-colors ${
                  settings.contrast === option.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary"
                }`}
              >
                <span className="block text-base font-semibold">{option.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{option.help}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Movement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Toggle
              id="animations"
              label="Allow gentle animations"
              checked={settings.animations}
              onChange={(checked) => update({ animations: checked })}
            />
            <Toggle
              id="reduced"
              label="Reduce motion (stops all movement)"
              checked={settings.reducedMotion}
              onChange={(checked) => update({ reducedMotion: checked })}
            />
            <Toggle
              id="ruler"
              label="Highlight one line at a time while reviewing"
              checked={settings.readingRuler}
              onChange={(checked) => update({ readingRuler: checked })}
            />
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Read-aloud</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Control
              label={`Playback speed (${settings.speechRate.toFixed(2)}x)`}
              value={settings.speechRate * 100}
              min={50}
              max={150}
              step={5}
              onChange={(value) => update({ speechRate: value / 100 })}
            />
            <ReadAloud text={SAMPLE} label="Try this speed" />
          </CardContent>
        </Card>

        <Button variant="ghost" size="lg" onClick={reset}>
          <RotateCcw className="mr-2 size-4" /> Put everything back to the start
        </Button>
      </main>
    </div>
  );
}

function Control({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-base">{label}</Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next ?? value)}
        aria-label={label}
      />
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
