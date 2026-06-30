#!/usr/bin/env node
import { interpret } from "./interpret.js";
import { gatherContext } from "./context.js";

/**
 * Thin CLI wrapper so any app (Retermina, a shell alias, a script) can shell out:
 *
 *   iris-nl "undo my last commit but keep changes"
 *
 * It prints a single JSON line to stdout. This is the integration boundary —
 * no server, no port, runs on demand and exits.
 */
async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    process.stderr.write('Usage: iris-nl "<plain-English request>"\n');
    process.exit(2);
  }

  try {
    const suggestion = await interpret({ query, context: gatherContext() });
    process.stdout.write(JSON.stringify(suggestion) + "\n");
  } catch (err) {
    // Always emit valid JSON so the caller never has to parse a stack trace.
    process.stdout.write(
      JSON.stringify({
        command: "",
        explanation: `iris-nl error: ${(err as Error).message}`,
        danger: false,
        provider: "none",
        error: true,
      }) + "\n",
    );
    process.exit(1);
  }
}

main();
