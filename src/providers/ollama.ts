import type { Provider } from "../types.js";

export interface OllamaOptions {
  model: string;
  baseUrl: string;
}

/**
 * Talks to a local Ollama instance (https://ollama.com). Runs entirely on the
 * user's machine on demand — no key, no network, no server to deploy.
 */
export class OllamaProvider implements Provider {
  readonly name = "ollama";
  constructor(private readonly opts: OllamaOptions) {}

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.opts.model,
          stream: false,
          format: "json", // nudge Ollama toward valid JSON output
          options: { temperature: 0.2 },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        // Generous: a cold model load can take a while, but never hang forever.
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      if ((err as Error).name === "TimeoutError") {
        throw new Error(`Ollama request timed out after 120s (model: ${this.opts.model}).`);
      }
      throw new Error(
        `Could not reach Ollama at ${this.opts.baseUrl}. Is it running? Install from https://ollama.com and run \`ollama pull ${this.opts.model}\`. (${(err as Error).message})`,
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }
}
