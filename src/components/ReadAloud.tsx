import { Loader2, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useA11y } from "@/lib/a11y";

export function ReadAloud({
  text,
  label = "Read aloud",
  size = "lg",
}: {
  text: string;
  label?: string;
  size?: "sm" | "lg" | "default";
}) {
  const { speak, stopSpeaking, speakingText, loadingVoice } = useA11y();
  const mine = speakingText === text;
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={() => (mine ? stopSpeaking() : void speak(text))}
    >
      {mine && loadingVoice ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : mine ? (
        <Pause className="mr-2 size-4" />
      ) : (
        <Volume2 className="mr-2 size-4" />
      )}
      {mine ? "Stop" : label}
    </Button>
  );
}
