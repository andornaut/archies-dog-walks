import { itemAt } from "@andornaut/game-kit/runtime/arrays";

// The nearest-rank percentile of sorted values.
export function percentile(sorted: readonly number[], fraction: number): number {
  return sorted.length === 0
    ? Number.NaN
    : itemAt(sorted, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
}

export const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
