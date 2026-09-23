import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Clock, Plus, Star, Wand2 } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dueItems,
  formatById,
  groupIntoSets,
  loadLibrary,
  loadProfile,
  rankFormats,
  updateLibraryItem,
  type MnemonicSet,
  type SavedMnemonic,
} from "@/lib/mnemonics";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "My learning space — MemoryShift" },
      {
        name: "description",
        content:
          "See your recent memory aid sets, your saved favourites, and what is ready to review today.",
      },
      { property: "og:title", content: "My learning space — MemoryShift" },
      {
        property: "og:description",
        content: "Recent sets, favourites and today's review, all on one calm page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearnerHome,
});

function LearnerHome() {
  const [library, setLibrary] = useState<SavedMnemonic[] | null>(null);
  const [topFormats, setTopFormats] = useState<string[]>([]);

  useEffect(() => {
    setLibrary(loadLibrary());
    setTopFormats(rankFormats(loadProfile()).slice(0, 3));
  }, []);

  const sets = useMemo<MnemonicSet[]>(() => (library ? groupIntoSets(library) : []), [library]);
  const favourites = useMemo(() => (library ?? []).filter((item) => item.favourite), [library]);
  const due = useMemo(() => (library ? dueItems(library) : []), [library]);

  function toggleFavourite(id: string) {
    updateLibraryItem(id, (item) => ({ ...item, favourite: !item.favourite }));
    setLibrary(loadLibrary());
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl px-5 py-10 space-y-12">
        <section className="space-y-4">
          <h1 className="text-3xl font-bold sm:text-4xl">Your learning space</h1>
          <p className="text-lg text-muted-foreground">
            Pick up where you left off, or make something new.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-2 border-primary/40">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpenCheck className="size-5 text-primary" /> Ready to review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">{due.length}</p>
                <Button asChild size="lg" disabled={due.length === 0}>
                  <Link to="/review">
                    {due.length > 0 ? "Start reviewing" : "Nothing due yet"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="size-5 text-primary" /> Favourites
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">{favourites.length}</p>
                <p className="text-base text-muted-foreground">Saved for quick practice.</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wand2 className="size-5 text-primary" /> Make something
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-base text-muted-foreground">
                  Notes, photos, formulas, audio or video.
                </p>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/studio">
                    <Plus className="mr-2 size-4" /> New memory aid
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
          {topFormats.length > 0 && (
            <p className="text-base text-muted-foreground">
              Your top kinds right now:{" "}
              <span className="font-semibold text-foreground">
                {topFormats.map((id) => formatById(id as never).name).join(", ")}
              </span>{" "}
              ·{" "}
              <Link to="/profile" className="font-semibold underline">
                adjust these
              </Link>
            </p>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Recent sets</h2>
          {library === null && <p className="text-lg text-muted-foreground">Loading…</p>}
          {library !== null && sets.length === 0 && (
            <Card className="border-2">
              <CardContent className="space-y-4 pt-6 text-lg">
                <p>You haven't made any memory aids yet.</p>
                <Button asChild size="lg">
                  <Link to="/studio">Make your first one</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {sets.slice(0, 6).map((set) => (
              <Card key={set.setId} className="border-2">
                <CardHeader className="gap-1">
                  <CardTitle className="text-lg">{set.sourceLabel}</CardTitle>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4" />
                    {new Date(set.createdAt).toLocaleDateString()} · {set.items.length} card(s)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {set.items.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3">
                        <span className="text-base">
                          <span aria-hidden className="mr-1">
                            {formatById(item.format).emoji}
                          </span>
                          {item.title}
                        </span>
                        <button
                          type="button"
                          aria-label={
                            item.favourite
                              ? `Remove ${item.title} from favourites`
                              : `Save ${item.title} to favourites`
                          }
                          aria-pressed={item.favourite}
                          onClick={() => toggleFavourite(item.id)}
                          className="rounded-lg p-2 hover:bg-secondary"
                        >
                          <Star
                            className={`size-5 ${
                              item.favourite ? "fill-accent text-accent" : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline">
                    <Link to="/review">Review these</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {favourites.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold">Saved favourites</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {favourites.map((item) => (
                <Card key={item.id} className="border-2 border-accent/60">
                  <CardHeader className="gap-1">
                    <p className="text-sm font-semibold text-primary">
                      <span aria-hidden className="mr-1">
                        {formatById(item.format).emoji}
                      </span>
                      {formatById(item.format).name} · {item.sourceLabel}
                    </p>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="whitespace-pre-line text-base">{item.body}</p>
                    <Button variant="ghost" onClick={() => toggleFavourite(item.id)}>
                      Remove from favourites
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
