# Iris-NL — Natural-Language Shell Commands

Turn plain-English requests into shell commands. Pluggable model providers — use
**NVIDIA's free hosted API** or a **local Ollama model**, no server to run, no bill.

```
$ iris-nl "undo my last commit but keep my changes"
{"command":"git reset --soft HEAD~1","explanation":"Undoes the last commit but keeps your changes staged.","danger":false,"provider":"nvidia"}
```

Built as the natural-language brain for the [Retermina](https://github.com/matthewhamilton3141/Retermina)
terminal's *Iris* command bar, but usable from any app, script, or shell.

## Why

A command bar that only matches commands you already know doesn't help when you don't
know the command. `iris-nl` lets you describe the goal and get the command — then your
app shows it for confirmation before anything runs.

## Install

```bash
npm install
npm run build
```

## Try it offline (no key, no Ollama)

The `mock` provider runs the whole pipeline with canned answers, so you can see the
shape before wiring up real AI:

```bash
npm run demo -- "undo my last commit"
npm test          # runs the offline pipeline + safety checks
```

## Pick a brain

Set `IRIS_NL_PROVIDER` (or leave it `auto`). Copy `.env.example` to `.env`.

| Provider | Cost | Setup | Offline |
|----------|------|-------|---------|
| `nvidia` | Free tier (~40 req/min), no card | Free key at [build.nvidia.com](https://build.nvidia.com) | No |
| `ollama` | Free forever | Install [Ollama](https://ollama.com), `ollama pull llama3.2` | Yes |
| `tensorrt` | Free | Your own TensorRT-LLM engine via `trtllm-serve` (see [`bench/`](bench/)) | Yes |
| `mock`   | Free | none | Yes |

`auto` uses NVIDIA when `NVIDIA_API_KEY` is set, otherwise falls back to Ollama.

```bash
# NVIDIA
export NVIDIA_API_KEY=nvapi-xxxx
iris-nl "compress this folder into a tarball"

# Local Ollama
export IRIS_NL_PROVIDER=ollama
iris-nl "show me the 10 biggest files here"
```

## Use as a library

```ts
import { interpret, gatherContext } from "iris-nl";

const result = await interpret({
  query: "undo my last commit but keep changes",
  context: gatherContext(),
});
// result: { command, explanation, danger, provider }
```

## The contract

Every provider returns the same shape, so the rest of your app never cares which brain
answered:

```jsonc
// in
{ "query": "...", "context": { "cwd": "...", "os": "macos", "gitBranch": "main" } }
// out
{ "command": "...", "explanation": "...", "danger": false, "provider": "nvidia" }
```

## Safety

`iris-nl` only *suggests*. Your app should always show the command and require
confirmation before running it. On top of the model's own `danger` flag, a local
pattern check (`src/safety.ts`) independently flags destructive commands (`rm -rf`,
`git push --force`, `dd`, fork bombs, …) so `danger` is never a false negative.

## Adding a provider

Implement one method:

```ts
class MyProvider implements Provider {
  readonly name = "mine";
  async complete(system: string, user: string): Promise<string> { /* return raw text */ }
}
```

## License

MIT
