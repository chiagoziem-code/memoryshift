import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import { MnemonicCard } from "@/components/MnemonicCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FORMATS,
  defaultProfile,
  formatById,
  loadLibrary,
  loadProfile,
  rankFormats,
  saveProfile,
  type FormatId,
  type Profile,
  type SavedMnemonic,
} from "@/lib/mnemonics";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My memory profile — MemoryShift" },
      {
        name: "description",
        content:
          "See which memory-aid formats suit you, mark favourites, hide the ones you dislike, and revisit everything you have made.",
      },
      { property: "og:title", content: "My memory profile — MemoryShift" },
      {
        property: "og:description",
        content: "Refine your mnemonic preferences over time and revisit your saved memory aids.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [library, setLibrary] = useState<SavedMnemonic[]>([]);

  useEffect(() => {
    setProfile(loadProfile());
    setLibrary(loadLibrary());
  }, []);

  function update(next: Profile) {
    setProfile(next);
    saveProfile(next);
  }

  function toggleList(key: "favourites" | "avoided", id: FormatId) {
    if (!profile) return;
    const other = key === "favourites" ? "avoided" : "favourites";
    const has = profile[key].includes(id);
    update({
      ...profile,
      [key]: has ? profile[key].filter((f) => f !== id) : [...profile[key], id],
      [other]: profile[other].filter((f) => f !== id),
    } as Profile);
  }

  if (!profile) {
    return (
      <div className="min-h-screen">
        <AppNav />
        <main className="mx-auto w-full max-w-3xl px-5 py-12">
          <p className="text-lg text-muted-foreground">Loading your profile…</p>
        </main>
      </div>
    );
  }

  const ranked = rankFormats(profile);
  const maxScore = Math.max(4, ...FORMATS.map((f) => profile.scores[f.id] ?? 0));

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">My memory profile</h1>
          <p className="text-lg text-muted-foreground">
            {profile.calibrated
              ? "Built from your quiz answers and everything you've said yes or no to since."
              : "You haven't taken the quiz yet — these are neutral starting values."}
          </p>
          {!profile.calibrated && (
            <Button asChild size="lg">
              <Link to="/onboarding">Take the calibration quiz</Link>
            </Button>
          )}
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">How well each format fits you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {ranked.map((id) => {
              const format = formatById(id);
              const score = profile.scores[id] ?? 0;
              return (
                <div key={id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      <span aria-hidden className="mr-2">
                        {format.emoji}
                      </span>
                      {format.name}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={profile.favourites.includes(id) ? "default" : "outline"}
                        onClick={() => toggleList("favourites", id)}
                      >
                        Favourite
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={profile.avoided.includes(id) ? "destructive" : "outline"}
                        onClick={() => toggleList("avoided", id)}
                      >
                        Hide
                      </Button>
                    </div>
                  </div>
                  <Progress
                    value={Math.max(0, (score / maxScore) * 100)}
                    className="h-3"
                    aria-label={`${format.name} fit`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Reading comfort</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="reading" className="text-base">
              Extra-simple wording, one idea per line
            </Label>
            <Switch
              id="reading"
              checked={profile.readingLevel === "simple"}
              onCheckedChange={(checked) =>
                update({ ...profile, readingLevel: checked ? "simple" : "standard" })
              }
            />
          </CardContent>
        </Card>

        <div>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              update(defaultProfile());
              toast.success("Profile reset — take the quiz again whenever you like");
            }}
          >
            <RotateCcw className="mr-2 size-4" /> Start my profile over
          </Button>
        </div>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Everything I've made</h2>
          {library.length === 0 ? (
            <p className="text-lg text-muted-foreground">
              Nothing saved yet.{" "}
              <Link to="/studio" className="font-semibold underline">
                Make your first memory aid
              </Link>
              .
            </p>
          ) : (
            library.map((item) => <MnemonicCard key={item.id} item={item} />)
          )}
        </section>
      </main>
    </div>
  );
}
