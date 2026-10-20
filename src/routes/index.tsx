import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FileUp, Image as ImageIcon, Mic, Sigma, Video, Wand2 } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FORMATS } from "@/lib/mnemonics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MemoryShift — memory aids made for dyslexic learners" },
      {
        name: "description",
        content:
          "Turn notes, photos, formulas, audio and video into rhymes, stories, pictures and other memory aids that match how you learn.",
      },
      { property: "og:title", content: "MemoryShift — memory aids made for dyslexic learners" },
      {
        property: "og:description",
        content:
          "Take a short calibration quiz, upload anything you need to learn, and get memory aids in the formats that work for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const inputs = [
  { icon: FileText, label: "Notes and text" },
  { icon: FileUp, label: "Documents" },
  { icon: ImageIcon, label: "Photos of pages" },
  { icon: Sigma, label: "Formulas" },
  { icon: Mic, label: "Audio recordings" },
  { icon: Video, label: "Video clips" },
];

function Home() {
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-12 space-y-14">
        <section className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/40 px-4 py-1.5 text-sm font-semibold">
            <Wand2 className="size-4" /> Built for dyslexic learners
          </span>
          <h1 className="text-4xl font-bold sm:text-5xl">
            Turn anything you need to learn into a memory aid that sticks.
          </h1>
          <p className="text-xl text-muted-foreground">
            Paste notes, snap a photo of a page or formula, or drop in a recording. MemoryShift
            gives it back to you as a rhyme, a story, a picture, a doodle plan — whichever kind
            your brain holds onto best.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="text-lg">
              <Link to="/onboarding">Start the 6-question quiz</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg">
              <Link to="/studio">Skip to the studio</Link>
            </Button>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Bring it in any way you like</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {inputs.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-4 font-medium"
              >
                <Icon className="size-5 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Nine kinds of memory aid</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map((format) => (
              <Card key={format.id} className="border-2">
                <CardHeader className="gap-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span aria-hidden>{format.emoji}</span>
                    {format.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-base text-muted-foreground">
                  {format.tagline}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border-2 border-border bg-card p-8 space-y-4">
          <h2 className="text-2xl font-semibold">It gets to know you</h2>
          <p className="text-lg text-muted-foreground">
            The quiz gives you a starting profile. Every time you say “more like this” or “not for
            me”, your profile shifts, so the suggestions on top become the ones you actually use.
          </p>
          <Button asChild variant="secondary" size="lg">
            <Link to="/profile">See my profile</Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
