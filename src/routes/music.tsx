import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Download, Music, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { downloadBlob, rememberSong } from "@/lib/audio";
import { loadLibrary, saveLibrary } from "@/lib/mnemonics";
import { SONGS, SONG_TOPICS, songToSaved } from "@/lib/songs";

export const Route = createFileRoute("/music")({
  head: () => ({
    meta: [
      { title: "Music library: memory songs — MemoryShift" },
      {
        name: "description",
        content:
          "Listen to ready-made memory songs with lyrics, and save any song as your own set to review.",
      },
      { property: "og:title", content: "Music library: memory songs — MemoryShift" },
      {
        property: "og:description",
        content: "Sing along to memory songs for planets, rainbows, BODMAS and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MusicPage,
});

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function MusicPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SONGS.filter((song) => {
      if (topic && song.topic !== topic) return false;
      if (!q) return true;
      return [song.title, song.subject, song.topic, song.style, song.lyrics, ...song.steps]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, topic]);

  /** Only one song plays at a time. */
  const onPlay = (event: React.SyntheticEvent<HTMLElement>) => {
    const playing = event.target;
    document.querySelectorAll("audio").forEach((audio) => {
      if (audio !== playing) audio.pause();
    });
  };

  const save = async (id: string) => {
    const song = SONGS.find((s) => s.id === id)!;
    setSaving(id);
    try {
      // Keep the track on the device so "Sing it" in Review plays it straight away.
      await rememberSong(song.lyrics, song.src).catch(() => undefined);
      saveLibrary([...songToSaved(song), ...loadLibrary()]);
      setSaved((s) => [...s, id]);
      toast.success(`"${song.title}" saved to your sets`);
    } finally {
      setSaving(null);
    }
  };

  const download = async (id: string) => {
    const song = SONGS.find((s) => s.id === id)!;
    try {
      const response = await fetch(song.src);
      if (!response.ok) throw new Error();
      downloadBlob(await response.blob(), `${song.title} song`);
    } catch {
      toast.error("Couldn't download the song. Please try again.");
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-10">
        <section className="space-y-3">
          <h1 className="flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            <Music className="size-8 text-primary" aria-hidden /> Music library
          </h1>
          <p className="text-lg text-muted-foreground">
            Sing along to memory songs. Save one you like and it joins your reviews.
          </p>
        </section>

        <section className="space-y-4">
          <label className="relative block">
            <span className="sr-only">Search songs</span>
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, e.g. planets, rainbow, months"
              className="h-12 pl-11 text-lg"
            />
          </label>
          <div className="space-y-2">
            <p className="font-semibold">Topic</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={topic === null} onClick={() => setTopic(null)}>
                All
              </Chip>
              {SONG_TOPICS.map((t) => (
                <Chip key={t} active={topic === t} onClick={() => setTopic(topic === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4" onPlayCapture={onPlay}>
          <p className="text-base text-muted-foreground">{results.length} song(s) found</p>
          {results.length === 0 && (
            <p className="text-lg">
              No songs match. Try another word, or browse the{" "}
              <Link to="/library" className="font-semibold underline">
                ready-made memory aids
              </Link>
              .
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((song) => {
              const isSaved = saved.includes(song.id);
              return (
                <Card key={song.id} className="border-2" data-testid="song-card">
                  <CardHeader className="gap-2">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-full bg-secondary px-3 py-1">{song.topic}</span>
                      <span className="rounded-full bg-accent px-3 py-1 text-accent-foreground">
                        🎵 {song.style}
                      </span>
                    </div>
                    <CardTitle className="text-xl">{song.title}</CardTitle>
                    <p className="text-base text-muted-foreground">{song.subject}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <audio controls preload="none" src={song.src} className="w-full">
                      Your browser can't play this song.
                    </audio>
                    <div className="rounded-xl bg-secondary/60 px-4 py-3">
                      <p className="mb-1 text-sm font-semibold">Lyrics</p>
                      <p className="whitespace-pre-line text-lg leading-relaxed">{song.lyrics}</p>
                    </div>
                    <p className="text-base">
                      <span className="font-semibold">Practise: </span>
                      {song.practiceTip}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void save(song.id)}
                        disabled={isSaved || saving === song.id}
                        size="lg"
                      >
                        {isSaved ? <Check className="mr-2 size-4" /> : <Plus className="mr-2 size-4" />}
                        {isSaved ? "Saved" : "Save as my set"}
                      </Button>
                      <Button variant="outline" size="lg" onClick={() => void download(song.id)}>
                        <Download className="mr-2 size-4" /> Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border-2 border-dashed border-border px-5 py-5 text-lg">
          <p className="font-semibold">Turn your own memory aid into a song</p>
          <p className="text-muted-foreground">
            Make a rhyme in the{" "}
            <Link to="/studio" className="font-semibold text-foreground underline">
              Studio
            </Link>
            , then press <span className="font-semibold text-foreground">Sing it</span> on the card.
          </p>
        </section>
      </main>
    </div>
  );
}
