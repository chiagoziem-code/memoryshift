import { useEffect, useState } from "react";
import { Download, Loader2, Music, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useA11y } from "@/lib/a11y";
import { TUNES, type TuneId } from "@/lib/audio.functions";
import { chantLines, downloadBlob, keepRhymeSong, speechClip, storedSong, tuneSong } from "@/lib/audio";
import { lyricsFor } from "@/components/MnemonicCard";
import { mixOverTrack } from "@/lib/mix";
import type { SavedMnemonic } from "@/lib/mnemonics";

const STYLE_IDS = (Object.keys(TUNES) as TuneId[]).filter((id) => id.startsWith("style:"));
const CLASSIC_IDS = (Object.keys(TUNES) as TuneId[]).filter((id) => id.startsWith("classic:"));
const OWN: TuneId = "own:chant";

/** The facts the song must carry: the rhyme and its lines. */
function factsFor(item: SavedMnemonic) {
  return [item.body, ...item.steps].join("\n");
}

/**
 * Turn a rhyme into a real, downloadable song.
 * Pick a style or a classic (public-domain) tune and the AI writes and sings it,
 * or pick your own music file and your words are spoken over it on this device.
 */
export function SongMaker({ item }: { item: SavedMnemonic }) {
  const { settings, stopSpeaking } = useA11y();
  const [tune, setTune] = useState<TuneId>("style:pop");
  const [ownFile, setOwnFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [song, setSong] = useState<
    { url: string; blob: Blob; lines: string[]; tune: TuneId | "saved" } | null
  >(null);

  // A song already on this device for this rhyme (e.g. from the Music library) shows straight away.
  useEffect(() => {
    let cancelled = false;
    void storedSong(lyricsFor(item)).then((blob) => {
      if (cancelled || !blob) return;
      setSong({
        url: URL.createObjectURL(blob),
        blob,
        lines: item.body.split("\n").filter((l) => l.trim()),
        tune: "saved",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => () => {
    if (song) URL.revokeObjectURL(song.url);
  }, [song]);

  async function make() {
    stopSpeaking();
    if (tune === OWN && !ownFile) {
      toast.error("Choose a music file first");
      return;
    }
    setBusy(true);
    try {
      let blob: Blob;
      let lines: string[];
      if (tune === OWN) {
        lines = await chantLines(factsFor(item), settings.localeStyle);
        let clips: Blob[];
        try {
          clips = await Promise.all(
            lines.map((line) => speechClip(line, settings.naturalVoice, settings.localeStyle)),
          );
        } catch (error) {
          throw new Error(
            `The voice for your song isn't available right now${error instanceof Error ? ` (${error.message})` : ""}.`,
          );
        }
        blob = await mixOverTrack(ownFile!, clips);
      } else {
        const out = await tuneSong(factsFor(item), tune, item.title, settings.localeStyle);
        blob = out.blob;
        lines = out.lines;
      }
      await keepRhymeSong(lyricsFor(item), blob);
      if (song) URL.revokeObjectURL(song.url);
      setSong({ url: URL.createObjectURL(blob), blob, lines, tune });
    } catch (error) {
      toast.error(
        error instanceof Error ? `Couldn't make the song. ${error.message}` : "Couldn't make the song.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-accent bg-accent/15 px-4 py-4" data-testid="song-maker">
      <p className="flex items-center gap-2 text-base font-semibold">
        <Music className="size-5 text-primary" /> Turn it into a song
      </p>

      {!song && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`tune-${item.id}`} className="text-base">
              Choose a tune
            </Label>
            <select
              id={`tune-${item.id}`}
              value={tune}
              onChange={(e) => setTune(e.target.value as TuneId)}
              className="w-full rounded-xl border-2 border-border bg-card px-3 py-3 text-base"
            >
              <optgroup label="A new tune made for you">
                {STYLE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {TUNES[id].label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Classic tunes (free to use)">
                {CLASSIC_IDS.map((id) => (
                  <option key={id} value={id}>
                    {TUNES[id].label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Your music">
                <option value={OWN}>Use my own music file…</option>
              </optgroup>
            </select>
          </div>

          {tune === OWN && (
            <div className="space-y-2">
              <Label htmlFor={`own-${item.id}`} className="text-base">
                Your music file
              </Label>
              <input
                id={`own-${item.id}`}
                type="file"
                accept="audio/*"
                onChange={(e) => setOwnFile(e.target.files?.[0] ?? null)}
                className="block w-full text-base"
              />
              <p className="text-sm text-muted-foreground">
                Pick a song or beat you like. Your words are spoken over it, and the file stays
                on this device.
              </p>
            </div>
          )}

          <Button type="button" size="lg" onClick={() => void make()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Music className="mr-2 size-5" />}
            {busy ? "Making your song… about 30 seconds" : "Make my song"}
          </Button>
        </>
      )}

      {song && (
        <div className="space-y-3" data-testid="song-result">
          <p className="text-sm text-muted-foreground">
            {song.tune === "saved"
              ? "Your saved song"
              : song.tune === OWN
                ? "Your words over your music"
                : TUNES[song.tune].label}
          </p>
          <audio controls autoPlay={song.tune !== "saved"} src={song.url} className="w-full" />
          {song.lines.length > 0 && (
            <ol className="space-y-1 rounded-xl bg-card px-4 py-3 text-lg">
              {song.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              onClick={() =>
                downloadBlob(
                  song.blob,
                  `${item.title} song${
                    song.tune === "saved" ? "" : song.tune === OWN ? " my music" : ` ${TUNES[song.tune].label}`
                  }`,
                )
              }
            >
              <Download className="mr-2 size-5" /> Save song
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setSong(null)}>
              <RotateCcw className="mr-2 size-5" /> Try another tune
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
