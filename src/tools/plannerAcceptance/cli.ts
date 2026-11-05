// Planner acceptance batch: npm run planner:acceptance -- <out-dir> [--commit <sha>]
import { USAGE_EXIT_CODE, UsageError } from "../usage.ts";
import { runBatch } from "./run.ts";

const USAGE = "Usage: planner:acceptance <out-dir> [--commit <sha>]";

function parse(args: readonly string[]): { commit: string | null; out: string } {
  const [out, ...rest] = args;
  if (out === undefined || out.startsWith("-")) {
    throw new UsageError(USAGE);
  }
  if (rest.length === 0) {
    return { commit: null, out };
  }
  if (rest.length === 2 && rest[0] === "--commit" && rest[1] !== undefined) {
    return { commit: rest[1], out };
  }
  throw new UsageError(USAGE);
}

try {
  const { commit, out } = parse(process.argv.slice(2));
  process.exitCode = runBatch(commit, out) ? 0 : 1;
} catch (error) {
  if (!(error instanceof UsageError)) {
    throw error;
  }
  console.error(error.message);
  process.exitCode = USAGE_EXIT_CODE;
}
