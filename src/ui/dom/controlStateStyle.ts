import { REFUSE, REFUSE_SHAKES, refuseShakeSteps } from "../refuse.ts";

// A refused control's shake, in steps of whole art pixels (--adw-slice-1) at the canvas's
// offsets and times (refuseShakeSteps), so it never passes through a blended sub-pixel place.
const SHAKE_KEYFRAMES = refuseShakeSteps()
  .map(
    ({ at, offset }) =>
      `${(at * 100).toFixed(3)}%{transform:translateX(calc(${offset} * var(--adw-slice-1)))}`,
  )
  .join("");

// The HTML interface's styles for a refused control: it shakes right and back (adw-refusing, or
// adw-shaking for the shake alone) and flashes its label red, or, under reduced motion, holds its
// label red, as refuseControl does on the canvas. The panel sets the flash's times on the control.
export const CONTROL_STATE_STYLE = `
.adw-refusing,.adw-shaking{animation:adw-shake ${2 * REFUSE.shakeMs}ms step-end ${REFUSE_SHAKES}}
.adw-refusing .adw-text{animation:adw-flash var(--adw-flash-ms) step-end var(--adw-flashes)}
.adw-refusing-still .adw-text{animation:adw-red var(--adw-refuse-ms) step-end}
@keyframes adw-shake{${SHAKE_KEYFRAMES}}
@keyframes adw-flash{50%{color:var(--adw-red)}}
@keyframes adw-red{from,to{color:var(--adw-red)}}
`;
