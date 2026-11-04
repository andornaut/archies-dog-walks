// Planner acceptance batch: npm run planner:acceptance -- <out-dir> [--commit <sha>]
import { runBatch } from "./run.ts";

const USAGE = "Usage: planner:acceptance <out-dir> [--commit <sha>]";

function parse(args: readonly string[]): { commit: string | null; out: string } {
  const [out, ...rest] = args;
  if (out === undefined || out.startsWith("-")) {
    throw new Error(USAGE);
  }
  if (rest.length === 0) {
    return { commit: null, out };
  }
  if (rest.length === 2 && rest[0] === "--commit" && rest[1] !== undefined) {
    return { commit: rest[1], out };
  }
  throw new Error(USAGE);
}

const { commit, out } = parse(process.argv.slice(2));
process.exitCode = runBatch(commit, out) ? 0 : 1;
