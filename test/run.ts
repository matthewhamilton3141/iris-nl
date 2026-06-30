/**
 * Zero-dependency test runner. Exercises the full pipeline offline using the
 * MockProvider, plus the safety net. Run with: npm test
 */
import { interpret } from "../src/interpret.js";
import { isDangerous } from "../src/safety.js";
import { MockProvider } from "../src/providers/mock.js";
import type { ShellContext } from "../src/types.js";

const ctx: ShellContext = { cwd: "/tmp/demo", os: "macos", gitBranch: "main" };
let failures = 0;

function check(name: string, cond: boolean) {
  process.stdout.write(`${cond ? "✓" : "✗"} ${name}\n`);
  if (!cond) failures++;
}

// 1. Safety net catches destructive commands regardless of the model.
check("safety flags rm -rf", isDangerous("rm -rf build"));
check("safety flags force push", isDangerous("git push origin main --force"));
check("safety allows ls", !isDangerous("ls -la"));

// 2. Full pipeline produces a structured suggestion from English.
const mock = new MockProvider();

const undo = await interpret({ query: "undo my last commit", context: ctx }, mock);
check("undo -> git reset --soft", undo.command === "git reset --soft HEAD~1");
check("undo carries an explanation", undo.explanation.length > 0);

const nuke = await interpret({ query: "delete all node_modules", context: ctx }, mock);
check("node_modules cmd is produced", nuke.command.includes("node_modules"));
check("node_modules flagged dangerous (rm -rf)", nuke.danger === true);

const unknown = await interpret({ query: "make me a sandwich", context: ctx }, mock);
check("unknown request -> empty command", unknown.command === "");

process.stdout.write(failures === 0 ? "\nAll passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
