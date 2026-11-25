// A refused control's labels flash red flashes times flashMs apart, and the control shakes
// shake pixels right and back four times, shakeMs each way.
export const REFUSE = { flashMs: 80, flashes: 4, shake: 3, shakeMs: 40 } as const;

// The whole pixels a refused control sits right of its place through one shake right and back,
// as the canvas draws its linear tween at whole pixels (rounded): each step's start, as a
// fraction of the shake there and back, and its offset.
export function refuseShakeSteps(): { at: number; offset: number }[] {
  const { shake } = REFUSE;
  const out = Array.from({ length: shake }, (_, i) => ({
    at: (i + 0.5) / shake / 2,
    offset: i + 1,
  }));
  const back = Array.from({ length: shake }, (_, i) => ({
    at: 1 - (shake - i - 0.5) / shake / 2,
    offset: shake - i - 1,
  }));
  return [{ at: 0, offset: 0 }, ...out, ...back];
}

// How many times a refused control shakes right and back: as long as its labels flash.
export const REFUSE_SHAKES = (REFUSE.flashMs * REFUSE.flashes) / (2 * REFUSE.shakeMs);

// Whether a refused control's labels are red elapsedMs into its refusal: on its odd flashes, or
// throughout under reduced motion, as refuseMotion and the DOM cue (refusal.ts) paint them.
export function refusalRed(reducedMotion: boolean, elapsedMs: number): boolean {
  const { flashMs, flashes } = REFUSE;
  return (
    elapsedMs >= 0 &&
    elapsedMs < flashMs * flashes &&
    (reducedMotion || Math.floor(elapsedMs / flashMs) % 2 === 1)
  );
}

// The whole pixels a refused control sits right of its place elapsedMs into its refusal, on the
// presenting scene's clock: the step shake (refuseShakeSteps) REFUSE_SHAKES times, or none under
// reduced motion.
export function refuseOffset(reducedMotion: boolean, elapsedMs: number): number {
  const period = 2 * REFUSE.shakeMs;
  if (reducedMotion || !(elapsedMs >= 0) || elapsedMs >= period * REFUSE_SHAKES) {
    return 0;
  }
  const at = (elapsedMs % period) / period;
  return (
    refuseShakeSteps()
      .filter((step) => step.at <= at)
      .at(-1)?.offset ?? 0
  );
}
