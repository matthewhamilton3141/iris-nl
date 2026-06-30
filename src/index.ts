// Public API of the iris-nl library. Consumers (like Retermina's Iris) import from here.
export { interpret } from "./interpret.js";
export { gatherContext } from "./context.js";
export { isDangerous } from "./safety.js";
export { createProvider, resolveProviderName } from "./config.js";
export type { ProviderName } from "./config.js";
export type {
  CommandSuggestion,
  InterpretRequest,
  Provider,
  ShellContext,
} from "./types.js";
