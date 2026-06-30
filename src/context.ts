import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import type { ShellContext } from "./types.js";

function osName(): string {
  switch (platform()) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

/** Best-effort current git branch; undefined if cwd isn't a repo. */
function currentGitBranch(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

/** Collect the shell context Iris passes to the model. */
export function gatherContext(cwd: string = process.cwd()): ShellContext {
  return {
    cwd,
    os: osName(),
    gitBranch: currentGitBranch(cwd),
  };
}
