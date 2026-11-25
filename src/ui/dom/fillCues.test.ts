import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { UI_STYLE } from "./uiStyle.ts";

// Each control family's stylesheet, comments and whitespace removed.
const css = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const KIT_CONTROLS = readFileSync(
  createRequire(import.meta.url).resolve("@andornaut/game-kit/runtime/web/ui/dom/controls.css"),
  "utf8",
);
const squeeze = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
// A page's own stylesheet, its <style> block.
const pageStyle = (path: string) => /<style>([\s\S]*?)<\/style>/u.exec(css(path))?.[1] ?? "";
const KIT_CRASH = readFileSync(
  createRequire(import.meta.url).resolve("@andornaut/game-kit/runtime/web/crash/dom/crash.css"),
  "utf8",
);
const SHEETS = {
  choice: squeeze(css("../../hud/dom/choiceCards.css")),
  controls: squeeze(css("../../../public/controls.css")),
  crash: squeeze(css("../../crash/crash.css")),
  focus: squeeze(css("./focusStyle.css")),
  gallery: squeeze(pageStyle("../../../public/art/index.html")),
  game: squeeze(css("./gameButton.css")),
  home: squeeze(pageStyle("../../../pages/index.html")),
  logbook: squeeze(css("../../hud/dom/logbook.css")),
  mute: squeeze(css("./muteControl.css")),
  nav: squeeze(css("../../../public/nav.css")),
  tile: squeeze(css("../../home/dom/selectionTile.css")),
  top: squeeze(css("./nativeTopSection.css")),
  ui: squeeze(UI_STYLE),
} as const;
// A sheet's rules from its forced-colours block on.
const forced = (sheet: string) => sheet.slice(sheet.indexOf("@media(forced-colors:active)"));
const CUE_SHEETS = { ...SHEETS, tileForced: forced(SHEETS.tile), topForced: forced(SHEETS.top) };

const FORCED_TOP_ARTWORK =
  "button.adw-top-section-button.ui-standard-button:is(:focus-visible, [data-ui-pressed])" +
  ' > .ui-button-face > [aria-hidden="true"]';
// A focused standard button's label, which must outrank Kit's focused artwork opacity.
const STANDARD_FOCUSED_LABEL =
  'button.adw-standard-button.ui-standard-button:focus-visible > .ui-button-face > [aria-hidden="true"]';
// Kit's focused artwork opacity, which the forced-colours top-bar artwork must outrank.
const KIT_FOCUSED_ARTWORK =
  'button.ui-standard-button:focus-visible > .ui-button-face > [aria-hidden="true"]';

// A focused or pressed Pet shop row, by Tab or by the Start picker.
const PLATE_STATES =
  ".adw-selection-tile:is(:focus-visible, [data-ui-pressed]," +
  " .adw-picker-surface:not(:has(:focus-visible)) [data-picker-focused])";

type Specificity = readonly [number, number, number];
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
const ranks = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
// A complex selector's specificity: ids; classes, attributes and pseudo-classes; types. :is()
// counts its most specific argument.
function specificity(selector: string): Specificity {
  const inner: Specificity[] = [];
  const rest = selector.replace(/:is\(([^()]*)\)/g, (_, args: string) => {
    inner.push(args.split(",").map(specificity).sort(ranks).at(-1)!);
    return "";
  });
  return inner.reduce<Specificity>(
    (sum, [a, b, c]) => [sum[0] + a, sum[1] + b, sum[2] + c],
    [
      count(rest, /#[\w-]+/g),
      count(rest, /\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g),
      count(rest, /(?:^|[\s>+~])[a-z][\w-]*/gi),
    ],
  );
}

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
      ":is(.adw-logbook-badge, .adw-end-badge-control).ui-standard-button:is(:focus-visible, [data-ui-pressed])" +
        ' > .ui-button-face > [aria-hidden="true"]',
      "opacity:1",
    ],
    [
      "a pressed Logbook row's or end-screen badge's face",
      "logbook",
      ":is(.adw-logbook-badge, .adw-end-badge-control)[data-ui-pressed] > .ui-button-face",
      "background-color:var(--ui-button-focus-fill)",
    ],
    [
      "a Logbook row's and end-screen badge's 35% focus fill",
      "logbook",
      ":is(.adw-logbook-badge, .adw-end-badge-control)",
      "--ui-button-focus-fill:color-mix(in srgb,var(--adw-cyan) 35%,transparent)",
    ],
    [
      "a focused or pressed locked badge's goal",
      "logbook",
      ".adw-logbook-badge:is(:focus-visible, [data-ui-pressed]) .adw-focus-colour .adw-text",
      "color:var(--adw-focus-colour)!important",
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
      '.adw-row:not([role=slider],[aria-disabled="true"],.adw-standard-button)[data-ui-pressed]>.adw-row-face',
      "background-color:var(--adw-green)!important",
    ],
    [
      "a refused row's icon, a white silhouette on the dark red face",
      "ui",
      ".adw-row:is([data-refusal-red],[data-ui-refusal-red]) .ui-form-row-icon>*",
      "filter:brightness(0)invert(1)",
    ],
    [
      "a focused or pressed row in forced colours",
      "ui",
      ".adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider]))>.adw-row-face",
      "background-color:Highlight!important",
    ],
    [
      "a pressed top-bar face",
      "top",
      ".adw-top-section-button[data-ui-pressed] .adw-top-section-fill",
      "var(--adw-ink)6.25%",
    ],
    [
      "a top-bar face in forced colours",
      "topForced",
      ".adw-top-section-fill",
      "display:block;forced-color-adjust:none;background:ButtonFace",
    ],
    [
      "a focused or pressed top-bar face in forced colours",
      "topForced",
      ".adw-top-section-button:is(:focus-visible, [data-ui-pressed]) .adw-top-section-fill",
      "background:Highlight",
    ],
    ["the forced-colours top-bar artwork", "top", FORCED_TOP_ARTWORK, "opacity:1"],
    [
      "a pressed Pet shop row's text colour",
      "tile",
      ".adw-selection-tile[data-ui-pressed]",
      "--adw-selection-focus-ink:var(--adw-ink)",
    ],
    [
      "a pressed Pet shop row's text, an unaffordable one's included",
      "tile",
      ".adw-selection-tile[data-ui-pressed]:not([data-picker-refusing]):not(.adw-refusing)" +
        ":not(.adw-refusing-still) :is(.adw-selection-focus-ink, .adw-selection-press-ink)",
      "color:var(--adw-selection-focus-ink)!important",
    ],
    [
      "a pressed unaffordable Pet shop row's text in forced colours",
      "tileForced",
      ".adw-selection-tile[data-ui-pressed] .adw-selection-press-ink",
      "forced-color-adjust:none",
    ],
    [
      "a focused unaffordable Pet shop row's text in forced colours",
      "tileForced",
      ".adw-selection-tile:not([data-picker-refusing], .adw-refusing, .adw-refusing-still):is(" +
        ":focus-visible, .adw-picker-surface:not(:has(:focus-visible)) [data-picker-focused])" +
        " .adw-selection-press-ink",
      "color:var(--adw-selection-focus-ink)!important;forced-color-adjust:none",
    ],
    [
      "a focused or pressed Pet shop row's price plate in forced colours",
      "tileForced",
      `${PLATE_STATES} .adw-selection-plate`,
      "background-color:ButtonFace!important;forced-color-adjust:none",
    ],
    [
      "a focused or pressed Pet shop row's price in forced colours",
      "tileForced",
      `${PLATE_STATES} .adw-selection-plate-ink`,
      "color:ButtonText!important;forced-color-adjust:none",
    ],
    [
      "a focused speech bubble",
      "ui",
      ".adw-button:focus-visible :is(.adw-speech-focus,.adw-speech-tail-focus)",
      "display:block",
    ],
    [
      "a pressed standard button's fill",
      "game",
      ".adw-standard-button[data-ui-pressed]",
      "--adw-button-fill:var(--adw-forest)",
    ],
    [
      "a pressed or disabled standard button's sunk flat face",
      "game",
      '.adw-standard-button:is([data-ui-pressed], :disabled, [aria-disabled="true"]) .adw-standard-button-face',
      "background:linear-gradient(var(--adw-button-fill),var(--adw-button-fill));transform:translateY",
    ],
    [
      "a disabled standard button's label",
      "game",
      '.adw-standard-button:is(:disabled, [aria-disabled="true"])',
      "--adw-button-text:var(--adw-neutralDarkSlate)",
    ],
    [
      "a primary button's bevel",
      "game",
      '.adw-standard-button[data-ui-button-role="primary"]',
      "--adw-button-highlight:var(--adw-yellow)",
    ],
    [
      "a focused site button's face",
      "controls",
      ".crash .crash-button:focus-visible",
      "--face:var(--palette-cyan);--face-text:var(--palette-ink);outline:none",
    ],
    [
      "a pressed site button's face",
      "controls",
      ".crash .crash-button:active:not(:disabled)",
      "--face:var(--palette-forest);--face-text:var(--palette-white)",
    ],
    [
      "a pressed site button's dip with no lip",
      "controls",
      ".crash .crash-button:active:not(:disabled)",
      "padding-top:var(--button-press);padding-bottom:var(--button-press);box-shadow:none",
    ],
    [
      "a focused nav link's press",
      "nav",
      ".art-nav a:focus-visible",
      "background:var(--palette-cyan)",
    ],
    [
      "the homepage screenshot link's focused heading band",
      "home",
      ".hl:has(.shot-link:focus-visible) h2",
      "background:var(--palette-cyan)",
    ],
    [
      "a focused gallery ground swatch's press",
      "gallery",
      ".toolbar .gr:has(input:focus-visible)",
      "background:var(--palette-cyan)",
    ],
  ] as const)("shows %s as a fill", (_what, sheet, selector, declaration) => {
    expect(rule(CUE_SHEETS[sheet], selector)).toContain(squeeze(declaration));
  });

  it("keeps a focused standard button's label at full opacity over Kit's focused artwork", () => {
    expect(rule(SHEETS.game, STANDARD_FOCUSED_LABEL)).toContain("opacity:1");
    expect(
      ranks(specificity(STANDARD_FOCUSED_LABEL), specificity(KIT_FOCUSED_ARTWORK)),
    ).toBeGreaterThan(0);
  });

  it("outranks Kit's focused artwork opacity with the forced-colours top-bar artwork", () => {
    expect(squeeze(KIT_CONTROLS)).toContain(`${squeeze(KIT_FOCUSED_ARTWORK)}{`);
    expect(specificity(KIT_FOCUSED_ARTWORK)).toEqual([0, 4, 1]);
    expect(
      ranks(specificity(FORCED_TOP_ARTWORK), specificity(KIT_FOCUSED_ARTWORK)),
    ).toBeGreaterThan(0);
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
    // Only the editable fields' inset bands remain, on native text editing: the seed field and
    // the gallery's zoom and filter.
    expect([...rings, ...afterRings]).toEqual([
      "focus: .adw-rowinput:focus-visible",
      'gallery: .toolbar:is(select,input[type="search"]):focus-visible',
    ]);
  });

  it("fills the crash screen's focused Error details row over Kit's outline", () => {
    const KIT_SUMMARY = ".crash-details summary:focus-visible";
    const SUMMARY = ".crash .crash-details summary:focus-visible";
    expect(squeeze(KIT_CRASH)).toContain(`${squeeze(KIT_SUMMARY)}{outline:`);
    expect(rule(SHEETS.crash, SUMMARY)).toContain("outline:none");
    expect(rule(forced(SHEETS.crash), SUMMARY)).toContain("outline:none");
    expect(ranks(specificity(SUMMARY), specificity(KIT_SUMMARY))).toBeGreaterThan(0);
  });
});
