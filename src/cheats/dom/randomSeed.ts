import { MAX_SEED } from "../index.ts";

// A seed for a URL without one: uniform over the seeds seededRandom distinguishes.
export function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}
