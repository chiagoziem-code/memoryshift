/**
 * Turn AI failures into messages people can act on. The AI SDK reports a
 * failed model call as "No output generated", which hides the real cause
 * (often an empty AI balance), so we keep the underlying error and explain it.
 */

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const e = error as Record<string, unknown>;
  for (const key of ["statusCode", "status"]) {
    if (typeof e[key] === "number") return e[key] as number;
  }
  const match = /\((\d{3})\)|status(?: code)?:? ?(\d{3})|\b(402|429|401|403|500|502|503)\b/.exec(String(e["message"] ?? ""));
  const found = match?.[1] ?? match?.[2] ?? match?.[3];
  return found ? Number(found) : null;
}

function detailOf(error: unknown): string {
  if (!error) return "";
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const body = typeof e["responseBody"] === "string" ? (e["responseBody"] as string) : "";
    const message = typeof e["message"] === "string" ? (e["message"] as string) : "";
    return (body || message).slice(0, 200);
  }
  return String(error).slice(0, 200);
}

export function friendlyAiError(error: unknown): Error {
  const status = statusOf(error);
  const detail = detailOf(error);
  if (status === 402 || /credit|balance|payment/i.test(detail)) {
    return new Error(
      "The AI credits for this app have run out, so nothing could be made. Top up the AI balance in Lovable, then try again.",
    );
  }
  if (status === 429) return new Error("The AI is busy right now. Wait a minute and try again.");
  if (status === 401 || status === 403) return new Error("The app couldn't sign in to the AI service. The AI key needs checking in Lovable.");
  return new Error(`The AI didn't answer this time. Try again in a moment.${detail ? ` (${detail})` : ""}`);
}

/** Keep the last stream error so a later "No output generated" can be explained. */
export function captureStreamErrors() {
  let last: unknown = null;
  return {
    onError: ({ error }: { error: unknown }) => {
      last = error;
      console.error("[ai]", error);
    },
    explain: (fallback: unknown) => friendlyAiError(last ?? fallback),
  };
}
