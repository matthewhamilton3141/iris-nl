import type { Provider } from "../types.js";

export interface NvidiaOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * Talks to NVIDIA's hosted NIM API (build.nvidia.com), which is OpenAI-compatible.
 * NVIDIA runs the model on their hardware — the user hosts nothing.
 */
export class NvidiaProvider implements Provider {
  readonly name = "nvidia";
  constructor(private readonly opts: NvidiaOptions) {}

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.opts.apiKey) {
      throw new Error(
        "NVIDIA_API_KEY is not set. Get a free key at https://build.nvidia.com, or use IRIS_NL_PROVIDER=ollama.",
      );
    }
    const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`NVIDIA API error ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
