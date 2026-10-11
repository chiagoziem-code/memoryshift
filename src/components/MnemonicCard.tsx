import { ThumbsDown, ThumbsUp } from "lucide-react";
import { ReadAloud } from "@/components/ReadAloud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatById, type SavedMnemonic } from "@/lib/mnemonics";

export function MnemonicCard({
  item,
  onFeedback,
}: {
  item: SavedMnemonic;
  onFeedback?: (liked: boolean) => void;
}) {
  const format = formatById(item.format);
  return (
    <Card className="border-2">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span aria-hidden>{format.emoji}</span>
          {format.name}
        </div>
        <CardTitle className="text-2xl">{item.title}</CardTitle>
        <div>
          <ReadAloud
            text={[item.title, item.body, ...item.steps, item.practiceTip].filter(Boolean).join(". ")}
            size="default"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-lg">
        <p className="whitespace-pre-line">{item.body}</p>
        {item.steps.length > 0 && (
          <ol className="space-y-2">
            {item.steps.map((step, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-secondary/60 px-4 py-3">
                <span className="font-semibold text-primary">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
        {item.practiceTip && (
          <p className="rounded-xl bg-accent/30 px-4 py-3 text-base">
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
