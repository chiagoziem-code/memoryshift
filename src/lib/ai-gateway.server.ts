import { createOpenAI } from "@ai-sdk/openai";

/**
 * Wraps fetch so the run id the gateway mints on the first call is resent on
 * later calls, which keeps app requests correlated with gateway usage logs.
 */
export function createLovableAiGatewayRunIdFetch(initialRunId?: string | null) {
  let runId = initialRunId ?? null;
  const wrapped: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    const response = await fetch(input as RequestInfo, { ...init, headers });
    const returned = response.headers.get("X-Lovable-AIG-Run-ID");
    if (returned) runId = returned;
    return response;
  };
  return {
    fetch: wrapped,
    get runId() {
      return runId;
    },
  };
}

export function createResponsesModel() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const lovable = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return lovable.responses("openai/gpt-6-astra");
}

export const responsesProviderOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;
