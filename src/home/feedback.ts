import { refuseOffset } from "../ui/index.ts";

// The home screen's tap feedback, from the art style guide: offsets in pixels and animation frames,
// each a function of how long ago its effect started. With reduced motion every movement is 0.
// Picker tiles give state and refusal feedback without lifting or dipping.

export const FEEDBACK = {
  // Ready Start walk rises 1px on every other beat.
  bobBeatMs: 600,
  // fx-dust plays at the gate when a dog is bought, if the screen is drawn soon enough.
  dustFrameMs: 80,
  hopMs: 480,
  hopPx: 4,
  liftPx: 2,
  pressDipMs: 140,
  pressDipPx: 2,
} as const;

// How long ago an effect started, or Infinity for one that never did.
function age(nowMs: number, startedMs: number | undefined): number {
  return startedMs === undefined ? Number.POSITIVE_INFINITY : nowMs - startedMs;
}

// A refused tap: the control shakes right and back, the refusal's step shake (refuseOffset).
export function shakeOffset(
  reducedMotion: boolean,
  nowMs: number,
  startedMs: number | undefined,
): number {
  return refuseOffset(reducedMotion, age(nowMs, startedMs));
}

// A bought dog's gate sprite hops twice: negative goes up.
export function hopOffset(
  reducedMotion: boolean,
  nowMs: number,
  startedMs: number | undefined,
): number {
  const elapsed = age(nowMs, startedMs);
  if (reducedMotion || elapsed >= FEEDBACK.hopMs) {
    return 0;
  }
  const phase = (elapsed / FEEDBACK.hopMs) * Math.PI * 2;
  return -Math.round(Math.abs(Math.sin(phase)) * FEEDBACK.hopPx) || 0;
}

// A press dips its tile for a moment, and for as long as the finger stays down.
export function pressDip(held: boolean, nowMs: number, startedMs: number | undefined): number {
  return held || age(nowMs, startedMs) < FEEDBACK.pressDipMs ? FEEDBACK.pressDipPx : 0;
}

// How long after nowMs a press's result waits so its dip shows first: the rest of the dip
// that started at startedMs, or 0 once it is over.
export function settleDelay(nowMs: number, startedMs: number): number {
  return Math.max(0, startedMs + FEEDBACK.pressDipMs - nowMs);
}

// The frame a looping tag, such as ui-afford's glint, shows at nowMs given each frame's
// duration; the first frame with reduced motion.
export function loopFrame(
  reducedMotion: boolean,
  durationsMs: readonly number[],
  nowMs: number,
): number {
  const total = durationsMs.reduce((sum, ms) => sum + ms, 0);
  if (reducedMotion || total <= 0) {
    return 0;
  }
  let into = nowMs % total;
  for (const [i, ms] of durationsMs.entries()) {
    if (into < ms) {
      return i;
    }
    into -= ms;
  }
  return 0;
}

// The ready Start walk button's rise: -1 on alternate beats, 0 while pressed or not ready.
export function bobOffset(reducedMotion: boolean, nowMs: number, ready: boolean): number {
  if (reducedMotion || !ready) {
    return 0;
  }
  return Math.floor(nowMs / FEEDBACK.bobBeatMs) % 2 === 1 ? -1 : 0;
}
