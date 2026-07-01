import type { Provider } from "../types.js";

export interface TensorRtOptions {
  /** Base URL of a local OpenAI-compatible server, e.g. trtllm-serve. */
  baseUrl: string;
  /** The model name the server was started with. */
  model: string;
}

/**
 * Talks to a LOCAL TensorRT-LLM model you optimized yourself (stage 2).
 *
 * TensorRT-LLM ships `trtllm-serve`, which exposes an OpenAI-compatible HTTP API.
 * So this provider is the same shape as the NVIDIA hosted one — but pointed at
 * localhost, with no API key, nothing leaving the machine. On the GPU box:
 *
 *   trtllm-serve ./trt_engine --host 0.0.0.0 --port 8000
 *
 * then:  IRIS_NL_PROVIDER=tensorrt iris-nl "undo my last commit"
 *
 * NOTE: stub — written without a running engine to test against. Confirm the served
 * model name and that your trtllm-serve version exposes /v1/chat/completions.
 */
export class TensorRtProvider implements Provider {
  readonly name = "tensorrt";
  constructor(private readonly opts: TensorRtOptions) {}

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.opts.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 400,
        }),
        // Generous: a cold engine load can take a while, but never hang forever.
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      if ((err as Error).name === "TimeoutError") {
        throw new Error("TensorRT-LLM request timed out after 120s.");
      }
      throw new Error(
        `Could not reach the local TensorRT-LLM server at ${this.opts.baseUrl}. ` +
          `Start it with \`trtllm-serve <engine> --port 8000\` on the GPU box. (${(err as Error).message})`,
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`TensorRT-LLM server error ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}
