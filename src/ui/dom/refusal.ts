import { REFUSE, REFUSE_SHAKES, refuseShakeSteps } from "../refuse.ts";

// The refusal cue on a DOM control that plays it on the page's own clock. adw-refusing shakes the
// control right and back in whole art pixels (--adw-slice-1) at the canvas's offsets and times
// (refuseShakeSteps), so it never passes through a blended sub-pixel place, and flashes each
// label in it (.adw-text) red; adw-refusing-still holds the labels red instead, under reduced
// motion. refuse sets the flash's times on the control.
const SHAKE_KEYFRAMES = refuseShakeSteps()
  .map(
    ({ at, offset }) =>
      `${(at * 100).toFixed(3)}%{transform:translateX(calc(${offset} * var(--adw-slice-1)))}`,
  )
  .join("");

const MOVING = "adw-refusing";
const STILL = "adw-refusing-still";

export const REFUSAL_STYLE = `
.${MOVING}{animation:adw-shake ${2 * REFUSE.shakeMs}ms step-end ${REFUSE_SHAKES}}
.${MOVING} .adw-text{animation:adw-flash var(--adw-flash-ms) step-end var(--adw-flashes)}
.${STILL} .adw-text{animation:adw-red var(--adw-refuse-ms) step-end}
@keyframes adw-shake{${SHAKE_KEYFRAMES}}
@keyframes adw-flash{50%{color:var(--adw-red)}}
@keyframes adw-red{from,to{color:var(--adw-red)}}
`;

// Plays the refusal cue on element for REFUSE's flashes: it shakes and its labels flash red, or,
// under reduced motion, its labels hold red. A refusal under way plays on.
export function refuse(reducedMotion: boolean, element: HTMLElement): void {
  if (element.classList.contains(MOVING) || element.classList.contains(STILL)) {
    return;
  }
  const { flashMs, flashes } = REFUSE;
  const total = flashMs * flashes;
  element.style.setProperty("--adw-flash-ms", `${2 * flashMs}ms`);
  element.style.setProperty("--adw-flashes", String(flashes / 2));
  element.style.setProperty("--adw-refuse-ms", `${total}ms`);
  const refusing = reducedMotion ? STILL : MOVING;
  element.classList.add(refusing);
  element.ownerDocument.defaultView?.setTimeout(() => element.classList.remove(refusing), total);
}
