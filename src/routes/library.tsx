import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FORMATS, formatById, loadLibrary, saveLibrary, type FormatId } from "@/lib/mnemonics";
import { PREMADE, TOPICS, premadeToSaved } from "@/lib/premade";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Ready-made memory aids — MemoryShift" },
      {
        name: "description",
        content: "Browse ready-made memory aids by topic and type, and save them as your own sets.",
      },
      { property: "og:title", content: "Ready-made memory aids — MemoryShift" },
      { property: "og:description", content: "Search memory aids by topic and type." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full border-2 border-border px-4 py-2 text-base transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
    >
      {children}
    </button>
  );
}

function LibraryPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatId | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PREMADE.filter((set) => {
      if (topic && set.topic !== topic) return false;
      if (format && !set.items.some((i) => i.format === format)) return false;
      if (!q) return true;
      const hay = [set.subject, set.topic, ...set.items.flatMap((i) => [i.title, i.body, formatById(i.format).name])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, topic, format]);

  const save = (id: string) => {
    const set = PREMADE.find((s) => s.id === id)!;
    saveLibrary([...premadeToSaved(set), ...loadLibrary()]);
    setSaved((s) => [...s, id]);
    toast.success(`"${set.subject}" saved to your sets`);
  };

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-10">
        <section className="space-y-3">
          <h1 className="text-3xl font-bold sm:text-4xl">Ready-made memory aids</h1>
          <p className="text-lg text-muted-foreground">
            Find one you like and save it. It will join your reviews.
          </p>
        </section>

        <section className="space-y-4">
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, e.g. planets, spelling, circle"
              className="h-12 pl-11 text-lg"
            />
          </label>
          <div className="space-y-2">
            <p className="font-semibold">Topic</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={topic === null} onClick={() => setTopic(null)}>All</Chip>
              {TOPICS.map((t) => (
                <Chip key={t} active={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Kind of memory aid</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={format === null} onClick={() => setFormat(null)}>All</Chip>
              {FORMATS.map((f) => (
                <Chip key={f.id} active={format === f.id} onClick={() => setFormat(format === f.id ? null : f.id)}>
                  <span aria-hidden className="mr-1">{f.emoji}</span>
                  {f.name}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-base text-muted-foreground">{results.length} set(s) found</p>
          {results.length === 0 && (
            <p className="text-lg">
              Nothing matches.{" "}
              <Link to="/studio" className="font-semibold underline">Make your own in the studio</Link>
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((set) => {
              const isSaved = saved.includes(set.id);
              return (
                <Card key={set.id} className="border-2">
                  <CardHeader className="gap-2">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-secondary px-3 py-1">{set.topic}</span>
                      {set.items.map((i) => (
                        <span key={i.title} className="rounded-full bg-accent px-3 py-1 text-accent-foreground">
                          {formatById(i.format).emoji} {formatById(i.format).name}
                        </span>
                      ))}
                    </div>
                    <CardTitle className="text-xl">{set.subject}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {set.items.map((i) => (
                      <div key={i.title} className="space-y-1">
                        <p className="font-semibold">{i.title}</p>
                        <p className="whitespace-pre-line text-base text-muted-foreground">{i.body}</p>
                      </div>
                    ))}
                    <Button onClick={() => save(set.id)} disabled={isSaved} size="lg">
                      {isSaved ? <Check className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
                      {isSaved ? "Saved" : "Save as my set"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
