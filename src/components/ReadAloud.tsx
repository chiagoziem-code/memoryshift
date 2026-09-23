import { Pause, Volume2 } from "lucide-react";
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
  const { speak, stopSpeaking, speaking } = useA11y();
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={() => (speaking ? stopSpeaking() : speak(text))}
    >
      {speaking ? <Pause className="mr-2 size-4" /> : <Volume2 className="mr-2 size-4" />}
      {speaking ? "Stop" : label}
    </Button>
  );
}
