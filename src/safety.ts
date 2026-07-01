/**
 * Patterns for commands that delete data, overwrite things, or are otherwise hard to undo.
 * This is a safety net layered ON TOP of the model's own `danger` flag — never trust the
 * model alone to decide what's destructive.
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-[a-z]*[rf]/i, // rm -rf, rm -f, rm -r ...
  /\bmkfs\b/i, // format a filesystem
  /\bdd\s+if=/i, // raw disk writes
  /\bgit\s+push\b[^\n]*--force/i, // force push
  /\bgit\s+reset\s+--hard\b/i, // discard changes
  /\bgit\s+clean\s+-[a-z]*f/i, // delete untracked files
  /\bchmod\s+-R\s+777\b/i,
  /\b(shutdown|reboot|halt)\b/i,
  />\s*\/dev\/(sd|nvme|disk)/i, // writing to a raw device
  /:\s*\(\s*\)\s*\{.*\}\s*;\s*:/, // fork bomb
  /\btruncate\b/i,
  /\b(curl|wget)\b[^|\n]*\|\s*(\S*\/)?(ba|z|da)?sh\b/i, // pipe a downloaded script into a shell
  /\bfind\b[^\n]*\s-delete\b/i, // bulk file deletion via find
];

/** True if the command matches any known-destructive pattern. */
export function isDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some((re) => re.test(command));
}
