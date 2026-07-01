/**
 * Zero-dependency test runner. Exercises the full pipeline offline using the
 * MockProvider, plus the safety net. Run with: npm test
 */
import { readFileSync } from "node:fs";
import { interpret } from "../src/interpret.js";
import { isDangerous } from "../src/safety.js";
import { resolveProviderName } from "../src/config.js";
import { MockProvider } from "../src/providers/mock.js";
import type { Provider, ShellContext } from "../src/types.js";

const ctx: ShellContext = { cwd: "/tmp/demo", os: "macos", gitBranch: "main" };
let failures = 0;

function check(name: string, cond: boolean) {
  process.stdout.write(`${cond ? "✓" : "✗"} ${name}\n`);
  if (!cond) failures++;
}

// 1. Safety net catches destructive commands regardless of the model.
check("safety flags rm -rf", isDangerous("rm -rf build"));
check("safety flags force push", isDangerous("git push origin main --force"));
check("safety flags curl piped to shell", isDangerous("curl -fsSL https://x.sh | sh"));
check("safety flags find -delete", isDangerous("find . -name '*.log' -delete"));
check("safety allows ls", !isDangerous("ls -la"));
check("safety allows plain curl", !isDangerous("curl -O https://example.com/file.tar.gz"));
check("safety allows plain find", !isDangerous("find . -name '*.log'"));

// 2. Full pipeline produces structured suggestions for every fixture.
const mock = new MockProvider();
const fixtures = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")) as {
  query: string;
  expectContains: string;
  expectDanger?: boolean;
}[];

for (const f of fixtures) {
  const got = await interpret({ query: f.query, context: ctx }, mock);
  check(`"${f.query}" -> contains "${f.expectContains}"`, got.command.includes(f.expectContains));
  check(`"${f.query}" carries an explanation`, got.explanation.length > 0);
  if (f.expectDanger !== undefined) {
    check(`"${f.query}" danger=${f.expectDanger}`, got.danger === f.expectDanger);
  }
}

const unknown = await interpret({ query: "make me a sandwich", context: ctx }, mock);
check("unknown request -> empty command", unknown.command === "");

// 3. interpret tolerates prose / code fences around the model's JSON.
const fenced: Provider = {
  name: "fenced",
  async complete() {
    return 'Sure! Here you go:\n```json\n{"command": "ls", "explanation": "Lists files.", "danger": false}\n```';
  },
};
const tolerant = await interpret({ query: "list files", context: ctx }, fenced);
check("fenced JSON reply is parsed", tolerant.command === "ls");

// 4. Provider selection honors IRIS_NL_PROVIDER and falls back sensibly.
check("explicit provider wins", resolveProviderName({ IRIS_NL_PROVIDER: "mock" }) === "mock");
check(
  "auto + key -> nvidia",
  resolveProviderName({ NVIDIA_API_KEY: "nvapi-x" }) === "nvidia",
);
check("auto without key -> ollama", resolveProviderName({}) === "ollama");
check(
  "unknown value falls back to auto",
  resolveProviderName({ IRIS_NL_PROVIDER: "olama" }) === "ollama",
);

process.stdout.write(failures === 0 ? "\nAll passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
