import type { Provider } from "./types.js";
import { NvidiaProvider } from "./providers/nvidia.js";
import { OllamaProvider } from "./providers/ollama.js";
import { TensorRtProvider } from "./providers/tensorrt.js";
import { MockProvider } from "./providers/mock.js";

export type ProviderName = "nvidia" | "ollama" | "tensorrt" | "mock";

/**
 * Decide which provider to use, honoring IRIS_NL_PROVIDER. The default ("auto")
 * picks NVIDIA when a key is present, otherwise local Ollama — so the thing works
 * with zero config if Ollama is installed, and upgrades to NVIDIA the moment a key exists.
 */
export function resolveProviderName(env: NodeJS.ProcessEnv = process.env): ProviderName {
  const explicit = (env.IRIS_NL_PROVIDER || "auto").toLowerCase();
  if (
    explicit === "nvidia" ||
    explicit === "ollama" ||
    explicit === "tensorrt" ||
    explicit === "mock"
  ) {
    return explicit;
  }
  // auto
  return env.NVIDIA_API_KEY ? "nvidia" : "ollama";
}

export function createProvider(
  name: ProviderName = resolveProviderName(),
  env: NodeJS.ProcessEnv = process.env,
): Provider {
  switch (name) {
    case "nvidia":
      return new NvidiaProvider({
        apiKey: env.NVIDIA_API_KEY ?? "",
        model: env.IRIS_NL_NVIDIA_MODEL || "meta/llama-3.1-8b-instruct",
        baseUrl: env.IRIS_NL_NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
      });
    case "ollama":
      return new OllamaProvider({
        model: env.IRIS_NL_OLLAMA_MODEL || "llama3.2",
        baseUrl: env.IRIS_NL_OLLAMA_BASE_URL || "http://localhost:11434",
      });
    case "tensorrt":
      return new TensorRtProvider({
        model: env.IRIS_NL_TENSORRT_MODEL || "tensorrt-llm",
        baseUrl: env.IRIS_NL_TENSORRT_BASE_URL || "http://localhost:8000/v1",
      });
    case "mock":
      return new MockProvider();
  }
}
