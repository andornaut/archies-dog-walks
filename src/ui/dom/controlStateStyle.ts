// The HTML interface's styles for a control's states beyond pressed and focused: a disabled
// button's grey face (ui-button's disabled art, its colour showing only while the art loads),
// and a refusal, which shakes a control --adw-shake device pixels and back --adw-shakes times
// and flashes its label red, or, under reduced motion, holds its label red, as refuseControl
// does on the canvas. The panel sets the lengths and times on the control.
export const CONTROL_STATE_STYLE = `
.adw-button.adw-disabled .adw-face{border-image-source:var(--adw-ui-button-disabled);
  background-color:var(--adw-neutralGrey)}
.adw-button.adw-go.adw-disabled .adw-face{border-image-source:var(--adw-ui-button-go-disabled)}
.adw-refusing{animation:adw-shake var(--adw-shake-ms) linear var(--adw-shakes) alternate}
.adw-refusing .adw-text{animation:adw-flash var(--adw-flash-ms) step-end var(--adw-flashes)}
.adw-refusing-still .adw-text{animation:adw-red var(--adw-refuse-ms) step-end}
@keyframes adw-shake{to{transform:translateX(var(--adw-shake))}}
@keyframes adw-flash{50%{color:var(--adw-red)}}
@keyframes adw-red{from,to{color:var(--adw-red)}}
`;
