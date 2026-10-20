import { useEffect, useState } from "react";
import { lyricsFor } from "@/components/MnemonicCard";
import { storedSong } from "@/lib/audio";
import type { SavedMnemonic } from "@/lib/mnemonics";

/** Plays a song already kept on this device for a rhyme (e.g. saved from the Music library). */
export function SavedSongPlayer({ item }: { item: SavedMnemonic }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item.format !== "rhyme") return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void storedSong(lyricsFor(item)).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [item]);

  if (!url) return null;
  return (
    <div className="space-y-2 rounded-xl bg-accent/30 px-4 py-3" data-testid="saved-song">
      <p className="text-base font-semibold">🎵 Sing along</p>
      <audio controls src={url} className="w-full" />
    </div>
  );
}
