import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { UI_STYLE } from "./uiStyle.ts";

// Each control family's stylesheet, comments and whitespace removed.
const css = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const squeeze = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
const SHEETS = {
  choice: squeeze(css("../../hud/dom/choiceCards.css")),
  focus: squeeze(css("./focusStyle.css")),
  game: squeeze(css("./gameButton.css")),
  logbook: squeeze(css("../../hud/dom/logbook.css")),
  top: squeeze(css("./nativeTopSection.css")),
  ui: squeeze(UI_STYLE),
} as const;

// The declarations of the first rule whose selector list ends with selector.
function rule(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${squeeze(selector)}{`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const start = at + squeeze(selector).length + 1;
  return sheet.slice(start, sheet.indexOf("}", start));
}

describe("control state cues", () => {
  it.each([
    [
      "the choice option's native focus",
      "choice",
      ".adw-choice-option:focus-visible",
      "outline:none",
    ],
    [
      "a focused choice card's band",
      "choice",
      ".adw-choice-group:has(.adw-choice-option:focus-visible) .adw-choice-press-band",
      "background:var(--adw-cyan)",
    ],
    [
      "an enabled pressed choice card's band",
      "choice",
      '.adw-choice-pressed:has(.adw-choice-option[aria-disabled="false"]) .adw-choice-press-band',
      "background:var(--adw-green)",
    ],
    [
      "a focused or pressed choice label in forced colours",
      "choice",
      '.adw-choice-pressed:has(.adw-choice-option[aria-disabled="false"]) .adw-choice-press-label *',
      "color:HighlightText!important",
    ],
    [
      "a focused or pressed Logbook row's content",
      "logbook",
      ".adw-logbook-badge.ui-standard-button:is(:focus-visible, [data-ui-pressed])" +
        ' > .ui-button-face > [aria-hidden="true"]',
      "opacity:1",
    ],
    [
      "a focused or pressed Logbook row's text in forced colours",
      "logbook",
      ".adw-logbook-badge:is(:focus-visible, [data-ui-pressed]) .adw-text",
      "color:HighlightText!important",
    ],
    [
      "a focused Settings row's face",
      "ui",
      ".adw-row:focus-visible>.adw-row-face",
      "background-color:var(--adw-cyan)!important",
    ],
    [
      "a pressed Settings or Cheats switch row's face",
      "ui",
      '.adw-row.ui-standard-button:not(.adw-standard-button,[aria-disabled="true"])[data-ui-pressed]>.ui-button-face',
      "background-color:var(--adw-green)!important",
    ],
    [
      "a focused or pressed row in forced colours",
      "ui",
      ".adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed])>:is(.adw-row-face,.ui-button-face)",
      "background-color:Highlight!important",
    ],
    [
      "a pressed top-bar face",
      "top",
      ".adw-top-section-button[data-ui-pressed] .adw-top-section-fill",
      "var(--adw-ink)6.25%",
    ],
    [
      "a focused or pressed top-bar face in forced colours",
      "top",
      ".adw-top-section-button:is(:focus-visible, [data-ui-pressed]) .adw-top-section-fill",
      "background:Highlight",
    ],
    [
      "the forced-colours top-bar artwork",
      "top",
      '.adw-top-section-button:is(:focus-visible, [data-ui-pressed]) > .ui-button-face > [aria-hidden="true"]',
      "opacity:1",
    ],
    [
      "a focused speech bubble",
      "ui",
      ".adw-button:focus-visible .adw-speech-focus",
      "display:block",
    ],
    [
      "an enabled pressed standard button's dip",
      "game",
      '.adw-standard-button[data-ui-pressed]:not(:disabled, [aria-disabled="true"]) .adw-standard-button-face',
      "transform:translateY",
    ],
  ] as const)("shows %s as a fill", (_what, sheet, selector, declaration) => {
    expect(rule(SHEETS[sheet], selector)).toContain(squeeze(declaration));
  });

  it("draws no focus ring, outline or ring-shaped shadow on a control", () => {
    const rings = Object.entries(SHEETS).flatMap(([name, sheet]) =>
      [...sheet.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)]
        .filter(([, , body]) =>
          /::after|outline:(?!none)|box-shadow:(?!none)[^;]*\d|border:[^;]*solid/.test(body!),
        )
        .map(([, selector]) => `${name}: ${selector}`),
    );
    const afterRings = Object.entries(SHEETS).flatMap(([name, sheet]) =>
      [...sheet.matchAll(/([^{}]*focus-visible[^{}]*::after)\{([^}]*)\}/g)]
        .filter(([, , body]) => !/content:none/.test(body!))
        .map(([, selector]) => `${name}: ${selector}`),
    );
    // Only the editable seed field's inset band remains, on native text editing.
    expect([...rings, ...afterRings]).toEqual(["focus: .adw-rowinput:focus-visible"]);
  });
});
