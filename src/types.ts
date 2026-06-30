/** The context Iris collects about the user's shell before asking for a command. */
export interface ShellContext {
  /** Current working directory. */
  cwd: string;
  /** Operating system: "macos" | "linux" | "windows". */
  os: string;
  /** Active git branch, if the cwd is a git repo. */
  gitBranch?: string;
}

/** What the caller sends in. This is the public contract between Iris and iris-nl. */
export interface InterpretRequest {
  /** The user's plain-English request, e.g. "undo my last commit but keep changes". */
  query: string;
  context: ShellContext;
}

/** What iris-nl returns. The other half of the public contract. */
export interface CommandSuggestion {
  /** The suggested single-line shell command (empty string if none could be produced). */
  command: string;
  /** One short, plain-English sentence explaining what the command does. */
  explanation: string;
  /** True if the command is destructive / hard to undo. Caller should warn before running. */
  danger: boolean;
  /** Which provider produced this ("nvidia" | "ollama" | "mock"). */
  provider: string;
}

/**
 * A model backend. Adding a new brain (OpenAI, Gemini, etc.) means implementing
 * this one method — nothing else in the library changes.
 */
export interface Provider {
  readonly name: string;
  /** Send a system + user prompt to the model, return its raw text reply. */
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
