// fn with at most limit calls in flight: a call made at the limit waits, in call order, for one
// to settle. Wrapping a file reader bounds the files open at once however its callers fan out.
export function limitConcurrency<A extends unknown[], R>(
  limit: number,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`concurrency limit must be a positive integer, not ${limit}`);
  }
  let active = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    const next = waiting.shift();
    if (next === undefined) {
      active--;
    } else {
      next();
    }
  };
  return async (...args) => {
    if (active < limit) {
      active++;
    } else {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    }
    try {
      return await fn(...args);
    } finally {
      release();
    }
  };
}
