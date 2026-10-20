import { useState } from "react";
import { Download, Loader2, Pause, Play, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useA11y } from "@/lib/a11y";
import { downloadBlob, speechClip } from "@/lib/audio";
import { SongMaker } from "@/components/SongMaker";
import { formatById, type SavedMnemonic } from "@/lib/mnemonics";

/** The pieces of a memory aid, in reading order: title, body, each step, practice tip. */
export function mnemonicParts(item: SavedMnemonic) {
  return [
    item.title,
    item.body,
    ...item.steps,
    item.practiceTip ? `Practise: ${item.practiceTip}` : "",
  ].filter((p) => p.trim().length > 0);
}

/** Lyrics for the sung version: the rhyme itself, plus its lines if the body is short. */
export function lyricsFor(item: SavedMnemonic) {
  const body = item.body.trim();
  return body.length >= 60 ? body : [body, ...item.steps].join("\n");
}

const highlight = "ring-4 ring-primary/40 bg-primary/10 rounded-xl";

export function MnemonicCard({
  item,
  onFeedback,
  activePart,
}: {
  item: SavedMnemonic;
  onFeedback?: (liked: boolean) => void;
  /** Part being read by an outside player (e.g. audio-first playlist); -1 or undefined for none. */
  activePart?: number;
}) {
  const format = formatById(item.format);
  const { speakParts, stopSpeaking, speakingText, loadingVoice, settings } = useA11y();
  const parts = mnemonicParts(item);
  const allText = parts.join(". ");
  const [ownPart, setOwnPart] = useState(-1);
  const [busy, setBusy] = useState<"download" | null>(null);

  const playingHere = speakingText === allText;
  const current = activePart !== undefined && activePart >= 0 ? activePart : playingHere ? ownPart : -1;

  // Index helpers so the right block lights up.
  const bodyIndex = 1;
  const stepStart = 2;
  const tipIndex = item.practiceTip ? stepStart + item.steps.length : -1;

  async function onDownload() {
    setBusy("download");
    try {
      const blob = await speechClip(allText, settings.naturalVoice, settings.localeStyle);
      downloadBlob(blob, item.title);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Couldn't make the audio file. ${error.message}`
          : "Couldn't make the audio file.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-2" data-testid="mnemonic-card">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span aria-hidden>{format.emoji}</span>
          {format.name}
        </div>
        <CardTitle className={`text-2xl ${current === 0 ? highlight : ""}`}>{item.title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            onClick={() =>
              playingHere ? stopSpeaking() : void speakParts(parts, (i) => setOwnPart(i))
            }
          >
            {playingHere && loadingVoice ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : playingHere ? (
              <Pause className="mr-2 size-5" />
            ) : (
              <Play className="mr-2 size-5" />
            )}
            {playingHere ? "Stop" : "Listen"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => void onDownload()}
            disabled={busy !== null}
          >
            {busy === "download" ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : (
              <Download className="mr-2 size-5" />
            )}
            Save audio
          </Button>
        </div>
        {item.format === "rhyme" && <SongMaker item={item} />}
      </CardHeader>
      <CardContent className="space-y-5 text-lg">
        <p className={`whitespace-pre-line px-1 ${current === bodyIndex ? highlight : ""}`}>
          {item.body}
        </p>
        {item.steps.length > 0 && (
          <ol className="space-y-2">
            {item.steps.map((step, i) => (
              <li
                key={i}
                className={`flex gap-3 rounded-xl bg-secondary/60 px-4 py-3 transition-shadow ${
                  current === stepStart + i ? highlight : ""
                }`}
              >
                <span className="font-semibold text-primary">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
        {item.practiceTip && (
          <p
            className={`rounded-xl bg-accent/30 px-4 py-3 text-base ${
              current === tipIndex ? highlight : ""
            }`}
          >
            <span className="font-semibold">Practise: </span>
            {item.practiceTip}
          </p>
        )}
        {onFeedback && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              variant={item.liked === true ? "default" : "outline"}
              size="lg"
              onClick={() => onFeedback(true)}
            >
              <ThumbsUp className="mr-2 size-4" /> More like this
            </Button>
            <Button
              type="button"
              variant={item.liked === false ? "destructive" : "outline"}
              size="lg"
              onClick={() => onFeedback(false)}
            >
              <ThumbsDown className="mr-2 size-4" /> Not for me
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
