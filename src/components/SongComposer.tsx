import { useEffect, useState } from "react";
import { Download, Loader2, Music, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lyricsFor } from "@/components/MnemonicCard";
import { composeSong, downloadBlob, songInfo, storedSong, type SongInfo } from "@/lib/audio";
import type { SavedMnemonic } from "@/lib/mnemonics";
import { SONG_STYLES, isLongSong, songStyleById, type SongStyleId } from "@/lib/song-styles";

/** One learner rhyme with a style picker and a Compose button that sings it. */
export function SongComposer({ item }: { item: SavedMnemonic }) {
  const lyrics = lyricsFor(item);
  const [style, setStyle] = useState<SongStyleId>("pop");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<SongInfo | null>(null);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the song already kept for this rhyme, if any.
  useEffect(() => {
    let cancelled = false;
    const kept = songInfo(lyrics);
    if (kept) {
      setInfo(kept);
      setStyle(kept.style);
    }
    void storedSong(lyrics).then((found) => {
      if (!cancelled && found) setBlob(found);
    });
    return () => {
      cancelled = true;
    };
  }, [lyrics]);

  // One object URL per song, released when replaced or unmounted.
  useEffect(() => {
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  async function compose() {
    setComposing(true);
    setError(null);
    try {
      const made = await composeSong(lyrics, style, item.title);
      setBlob(made);
      setInfo(songInfo(lyrics));
      toast.success(`"${item.title}" is ready to sing along to`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      toast.error(`Couldn't compose the song. ${message}`);
    } finally {
      setComposing(false);
    }
  }

  const long = isLongSong(lyrics);

  return (
    <Card className="border-2" data-testid="song-composer">
      <CardHeader className="gap-2">
        <p className="text-sm font-semibold text-primary">{item.sourceLabel}</p>
        <CardTitle className="text-xl">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-secondary/60 px-4 py-3">
          <p className="mb-1 text-sm font-semibold">Words to sing</p>
          <p className="whitespace-pre-line text-lg leading-relaxed">{lyrics}</p>
        </div>

        <fieldset className="space-y-2" disabled={composing}>
          <legend className="font-semibold">Pick a style</legend>
          <div className="flex flex-wrap gap-2">
            {SONG_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={style === s.id}
                onClick={() => setStyle(s.id)}
                className="rounded-full border-2 border-border px-4 py-2 text-base transition-colors aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:opacity-60"
              >
                <span aria-hidden className="mr-1">
                  {s.emoji}
                </span>
                {s.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => void compose()} disabled={composing}>
            {composing ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : blob ? (
              <RefreshCw className="mr-2 size-5" />
            ) : (
              <Music className="mr-2 size-5" />
            )}
            {composing ? "Composing…" : blob ? "Compose a new version" : "Compose my song"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {long ? "Full-length song, up to about 3 minutes" : "About 30 seconds long"}
          </span>
        </div>

        {composing && (
          <p className="rounded-xl bg-accent/30 px-4 py-3 text-base" role="status">
            Writing the music and singing your words. This can take up to a minute.
          </p>
        )}
        {error && !composing && (
          <p className="rounded-xl border-2 border-destructive px-4 py-3 text-base" role="alert">
            {error}
          </p>
        )}

        {url && blob && (
          <div className="space-y-2 rounded-xl bg-accent/30 px-4 py-3" data-testid="composed-song">
            <p className="text-base font-semibold">
              🎵 Your song{info ? ` · ${songStyleById(info.style).name}` : ""}
            </p>
            <audio controls src={url} className="w-full" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => downloadBlob(blob, `${item.title} song`)}
            >
              <Download className="mr-2 size-4" /> Download song
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
