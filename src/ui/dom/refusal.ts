import { refusalRed, REFUSE, REFUSE_SHAKES, refuseShakeSteps } from "../refuse.ts";

// The refusal cue on a DOM control that plays it on the page's own clock. adw-refusing shakes the
// control right and back in whole art pixels (--adw-slice-1) at the canvas's offsets and times
// (refuseShakeSteps), so it never passes through a blended sub-pixel place; adw-refusing-still
// holds it still under reduced motion. Through the red phases (refusalRed) the control holds
// data-refusal-red, which fills its face dark red under a white label and, on a row, its icon as
// a white silhouette (REFUSAL_STYLE and each control's skin), over any focus or press fill. In
// forced colours the face fills ButtonText under a ButtonFace label and icon, the inverse of the
// resting face, so a refusal stays distinct from Highlight focus; a row's icon is masked from its
// frame (paintSheetArt). A picker tile or Shop row, whose focus and press are that inverse, fills
// Highlight under HighlightText instead (selectionTile.css).
const SHAKE_KEYFRAMES = refuseShakeSteps()
  .map(
    ({ at, offset }) =>
      `${(at * 100).toFixed(3)}%{transform:translateX(calc(${offset} * var(--adw-slice-1)))}`,
  )
  .join("");

const MOVING = "adw-refusing";
const STILL = "adw-refusing-still";
export const REFUSAL_RED = "data-refusal-red";
// A row in a red phase, focused or pressed alike: outranks the focus and press fills
// (SETTINGS_STYLE), in forced colours too.
const ROW_RED_STATES =
  `.adw-row:not(.adw-standard-button)[${REFUSAL_RED}]` +
  ":is(*,:focus-visible,[data-ui-pressed]:not([role=slider]))";

export const REFUSAL_STYLE = `
.${MOVING}{animation:adw-shake ${2 * REFUSE.shakeMs}ms step-end ${REFUSE_SHAKES}}
@keyframes adw-shake{${SHAKE_KEYFRAMES}}
${ROW_RED_STATES}>.adw-row-face{background-color:var(--adw-darkRed)!important}
${ROW_RED_STATES} .adw-text{color:var(--adw-white)!important}
.adw-row[${REFUSAL_RED}] .ui-form-row-icon>*{filter:brightness(0) invert(1)}
@media (forced-colors:active){
  .adw-row[${REFUSAL_RED}],.adw-row[${REFUSAL_RED}] *{forced-color-adjust:none}
  ${ROW_RED_STATES}>.adw-row-face{background-color:ButtonText!important}
  ${ROW_RED_STATES} .adw-text{color:ButtonFace!important}
  .adw-row[${REFUSAL_RED}] .ui-form-row-icon>*{filter:none;
    background:ButtonFace!important;
    mask:var(--adw-art-image) var(--adw-art-position)/var(--adw-art-size) no-repeat}
}
`;

// Controls whose refusal is under way.
const refusing = new WeakSet<HTMLElement>();

// Whether a refusal plays on element (refuse's element) now.
export function refusalPlaying(element: HTMLElement): boolean {
  return refusing.has(element);
}

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
