import type { CommandSuggestion, InterpretRequest, Provider } from "./types.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";
import { isDangerous } from "./safety.js";
import { createProvider } from "./config.js";

/** Pull the first JSON object out of a model reply, tolerating stray prose or code fences. */
function extractJson(raw: string): { command?: string; explanation?: string; danger?: boolean } {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Model did not return JSON. Got: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * The core of the library: take a plain-English request + shell context, ask a
 * provider, and return a structured, safety-checked command suggestion.
 *
 * The provider is injectable so callers (and tests) can swap brains; when omitted
 * it is chosen from the environment (NVIDIA / Ollama / mock — see config.ts).
 */
export async function interpret(
  req: InterpretRequest,
  provider: Provider = createProvider(),
): Promise<CommandSuggestion> {
  const raw = await provider.complete(SYSTEM_PROMPT, buildUserPrompt(req));
  const parsed = extractJson(raw);

  const command = (parsed.command ?? "").trim();
  // Trust the safety net over the model: flag danger if EITHER says so.
  const danger = Boolean(parsed.danger) || isDangerous(command);

  return {
    command,
    explanation: parsed.explanation ?? "",
    danger,
    provider: provider.name,
  };
}
