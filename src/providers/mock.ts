import type { Provider } from "../types.js";

/**
 * A fake provider that needs no key, no network, and no Ollama. It does crude
 * keyword matching so the WHOLE pipeline (CLI -> interpret -> parse -> safety)
 * can be exercised offline. This is "stage 1" of the plan: prove the loop works
 * before any real AI is wired in. Not meant to be smart.
 */
export class MockProvider implements Provider {
  readonly name = "mock";

  async complete(_systemPrompt: string, userPrompt: string): Promise<string> {
    const q = userPrompt.toLowerCase();
    const table: { match: RegExp; command: string; explanation: string }[] = [
      {
        match: /undo .*commit|reset .*commit/,
        command: "git reset --soft HEAD~1",
        explanation: "Undoes the last commit but keeps your changes staged.",
      },
      {
        match: /port (\d+)|what.*using port/,
        command: "lsof -i :3000",
        explanation: "Shows which process is using port 3000.",
      },
      {
        match: /delete .*node_modules|remove .*node_modules/,
        command: "find . -name node_modules -type d -prune -exec rm -rf {} +",
        explanation: "Recursively deletes all node_modules folders below here.",
      },
      {
        match: /current branch|what branch/,
        command: "git rev-parse --abbrev-ref HEAD",
        explanation: "Prints the name of the current git branch.",
      },
      {
        match: /list .*files|show .*files/,
        command: "ls -la",
        explanation: "Lists all files in the current directory, including hidden ones.",
      },
    ];

    const hit = table.find((row) => row.match.test(q));
    const result = hit
      ? { command: hit.command, explanation: hit.explanation }
      : { command: "", explanation: "Mock provider has no canned answer for that request." };
    return JSON.stringify(result);
  }
}
