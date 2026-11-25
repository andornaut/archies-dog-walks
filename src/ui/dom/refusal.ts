import type { RefusalCue } from "@andornaut/game-kit/runtime/web/ui/dom/refusalCue";

import { refusalRed, REFUSE, REFUSE_SHAKES, refuseShakeSteps } from "../refuse.ts";

// The kit's refusal cue (refusalCue) for a kit control, in REFUSE's times: while it shakes, a
// row steps through the canvas's whole-art-pixel offsets (adw-shake), and its red phases fill
// its face dark red.
export const REFUSAL_CUE: RefusalCue = {
  shake: REFUSE.shake,
  shakeMs: REFUSE.shakeMs,
  shakeShape: "yoyo",
  stepMs: REFUSE.flashMs,
  steps: REFUSE.flashes,
};

// The refusal cue on a DOM control that plays it on the page's own clock. adw-refusing shakes the
// control right and back in whole art pixels (--adw-slice-1) at the canvas's offsets and times
// (refuseShakeSteps), so it never passes through a blended sub-pixel place; adw-refusing-still
// holds it still under reduced motion. Through the red phases (refusalRed) the control holds
// data-refusal-red, which fills its face dark red under a white label (REFUSAL_STYLE and each
// control's skin).
const SHAKE_KEYFRAMES = refuseShakeSteps()
  .map(
    ({ at, offset }) =>
      `${(at * 100).toFixed(3)}%{transform:translateX(calc(${offset} * var(--adw-slice-1)))}`,
  )
  .join("");

const MOVING = "adw-refusing";
const STILL = "adw-refusing-still";
export const REFUSAL_RED = "data-refusal-red";

export const REFUSAL_STYLE = `
.${MOVING}{animation:adw-shake ${2 * REFUSE.shakeMs}ms step-end ${REFUSE_SHAKES}}
@keyframes adw-shake{${SHAKE_KEYFRAMES}}
.adw-row:is([${REFUSAL_RED}],[data-ui-refusal-red])>.adw-row-face{background-color:var(--adw-darkRed)!important}
.adw-row:is([${REFUSAL_RED}],[data-ui-refusal-red]):is(*,[data-ui-pressed],:focus-visible) .adw-text{
  color:var(--adw-white)!important}
.adw-row[data-ui-refusal-shake]{translate:none;transition:none;
  animation:adw-shake ${2 * REFUSE.shakeMs}ms step-end ${REFUSE_SHAKES}}
`;

// Controls whose refusal is under way.
const refusing = new WeakSet<HTMLElement>();

// Plays the refusal cue on element for REFUSE's flashes: shaken (element unless given) shake, or
// hold still under reduced motion, while element shows the red phases. A refusal under way plays
// on.
export function refuse(
  reducedMotion: boolean,
  element: HTMLElement,
  shaken: readonly HTMLElement[] = [element],
): void {
  if (refusing.has(element)) {
    return;
  }
  refusing.add(element);
  const view = element.ownerDocument.defaultView;
  const { flashMs, flashes } = REFUSE;
  const cue = reducedMotion ? STILL : MOVING;
  for (const part of shaken) {
    part.classList.add(cue);
  }
  // At each flash's start the face takes that flash's colour; after the last it ends.
  for (let flash = 0; flash <= flashes; flash += 1) {
    const show = () => {
      if (flash < flashes) {
        element.toggleAttribute(REFUSAL_RED, refusalRed(reducedMotion, flash * flashMs));
        return;
      }
      element.removeAttribute(REFUSAL_RED);
      for (const part of shaken) {
        part.classList.remove(cue);
      }
      refusing.delete(element);
    };
    if (flash === 0) {
      show();
    } else {
      view?.setTimeout(show, flash * flashMs);
    }
  }
}
