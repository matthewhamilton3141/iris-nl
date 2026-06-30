# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is
`iris-nl` — a TypeScript library + CLI that turns plain-English requests into shell commands.
The "natural-language brain" for Retermina's *Iris* command bar, but usable standalone.
Input/output contract (`src/types.ts`):
`{ query, context:{cwd,os,gitBranch} } -> { command, explanation, danger, provider }`.

## Commands
```bash
npm run build              # tsc -> dist/
npm test                   # offline pipeline + safety tests (uses the mock provider)
npm run demo -- "..."      # run the CLI offline with the mock provider
npm run dev  -- "..."      # run the CLI with the env-selected provider
```

## Architecture
- `src/interpret.ts` — core: prompt -> provider -> parse JSON -> safety-check -> result.
- `src/providers/` — swappable model backends, all implementing `Provider.complete()`:
  `nvidia` (hosted free API), `ollama` (local), `tensorrt` (local trtllm-serve), `mock` (offline).
- `src/config.ts` — picks a provider from `IRIS_NL_PROVIDER` (default `auto`: NVIDIA if a key
  exists, else Ollama). Add a provider HERE after creating it.
- `src/cli.ts` — thin wrapper; always prints one JSON line. This is the integration boundary.
- `src/safety.ts` — independent regex check for destructive commands.
- `bench/` — Python inference benchmark (HF baseline vs TensorRT-LLM). Runs on a GPU box, not here.

## Conventions
- ESM + `NodeNext`: **imports must use the `.js` extension** even for `.ts` files
  (e.g. `import { interpret } from "./interpret.js"`). The build fails otherwise.
- Strict TypeScript. No new runtime dependencies without a good reason (currently zero).
- Keep the CLI's stdout to a single JSON object — callers parse it.

## Rules that matter
- **Never auto-run a command.** The library only suggests; the consumer must confirm before running.
- `danger` is true if EITHER the model OR `safety.ts` flags it — treat either as destructive.
- Adding a provider = implement `Provider` (one method) + wire it into `config.ts` + `.env.example`
  + the README table. Don't touch `interpret.ts`.

## Bigger picture (not in this repo)
- Integrating into Retermina: see `building-plans/iris-nl-retermina.md`.
- Stage-2 optimization (self-host + TensorRT-LLM + benchmark): `building-plans/iris-nl-stage2-tensorrt.md`.
