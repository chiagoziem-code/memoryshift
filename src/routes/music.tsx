import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Music, Search } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { SongComposer } from "@/components/SongComposer";
import { Input } from "@/components/ui/input";
import { LEARNER_DATA_EVENT, loadLibrary, type SavedMnemonic } from "@/lib/mnemonics";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "Compose memory songs from your rhymes — MemoryShift" },
      {
        name: "description",
        content:
          "Turn your own rhymes into sung memory songs. Pick a style, compose, sing along and download.",
      },
      { property: "og:title", content: "Compose memory songs from your rhymes — MemoryShift" },
      {
        property: "og:description",
        content: "Pick a style and hear your own rhymes sung back to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MusicPage,
});

function MusicPage() {
  const [rhymes, setRhymes] = useState<SavedMnemonic[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => {
      setRhymes(loadLibrary().filter((item) => item.format === "rhyme"));
      setLoaded(true);
    };
    refresh();
    window.addEventListener(LEARNER_DATA_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LEARNER_DATA_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rhymes;
    return rhymes.filter((r) =>
      [r.title, r.body, r.sourceLabel, ...r.steps].join(" ").toLowerCase().includes(q),
    );
  }, [rhymes, query]);

  /** Only one song plays at a time. */
  const onPlay = (event: React.SyntheticEvent<HTMLElement>) => {
    document.querySelectorAll("audio").forEach((audio) => {
      if (audio !== event.target) audio.pause();
    });
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-10">
        <section className="space-y-3">
          <h1 className="flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            <Music className="size-8 text-primary" aria-hidden /> My memory songs
          </h1>
          <p className="text-lg text-muted-foreground">
            Pick one of your rhymes, choose a style, and hear it sung. Your songs stay on this
            device and play again in Review.
          </p>
        </section>

        {loaded && rhymes.length === 0 ? (
          <section className="space-y-3 rounded-2xl border-2 border-dashed border-border px-5 py-6 text-lg">
            <p className="font-semibold">You don't have any rhymes yet.</p>
            <p className="text-muted-foreground">
              Make one in the{" "}
              <Link to="/studio" className="font-semibold text-foreground underline">
                Studio
              </Link>{" "}
              by choosing <span className="font-semibold text-foreground">Rhyme or song</span>, or
              save a rhyme from the{" "}
              <Link to="/library" className="font-semibold text-foreground underline">
                Library
              </Link>
              . It will appear here, ready to sing.
            </p>
          </section>
        ) : (
          <>
            {rhymes.length > 3 && (
              <label className="relative block">
                <span className="sr-only">Search your rhymes</span>
                <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your rhymes"
                  className="h-12 pl-11 text-lg"
                />
              </label>
            )}
            <section className="space-y-4" onPlayCapture={onPlay}>
              <p className="text-base text-muted-foreground">{results.length} rhyme(s)</p>
              <div className="grid gap-4 md:grid-cols-2">
                {results.map((item) => (
                  <SongComposer key={item.id} item={item} />
                ))}
              </div>
            </section>
            <p className="text-lg text-muted-foreground">
              Want another song?{" "}
              <Link to="/studio" className="font-semibold text-foreground underline">
                Write a new rhyme in the Studio
              </Link>
              .
            </p>
          </>
        )}
      </main>
    </div>
  );
}
