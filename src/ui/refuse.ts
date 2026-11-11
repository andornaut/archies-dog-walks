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
