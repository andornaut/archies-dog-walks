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
// A sheet's forced-colours blocks: where each starts and ends, and the rules inside it.
function forcedBlocks(sheet: string): { end: number; rules: string; start: number }[] {
  const head = "@media(forced-colors:active){";
  const blocks = [];
  for (let start = sheet.indexOf(head); start >= 0; start = sheet.indexOf(head, start + 1)) {
    let end = start + head.length;
    for (let depth = 1; depth > 0; end += 1) {
      depth += sheet[end] === "{" ? 1 : sheet[end] === "}" ? -1 : 0;
    }
    blocks.push({ end, rules: sheet.slice(start + head.length, end - 1), start });
  }
  return blocks;
}
// The rules inside a sheet's forced-colours blocks, in order, and the rules outside them.
const forced = (sheet: string) =>
  forcedBlocks(sheet)
    .map(({ rules }) => rules)
    .join("");
const unforced = (sheet: string) =>
  forcedBlocks(sheet)
    .reverse()
    .reduce((rest, { end, start }) => rest.slice(0, start) + rest.slice(end), sheet);
const CUE_SHEETS = {
  ...SHEETS,
  choiceForced: forced(SHEETS.choice),
  choiceNormal: unforced(SHEETS.choice),
  gameForced: forced(SHEETS.game),
  gameNormal: unforced(SHEETS.game),
  tileForced: forced(SHEETS.tile),
  topForced: forced(SHEETS.top),
  uiForced: forced(SHEETS.ui),
  uiNormal: unforced(SHEETS.ui),
};

const TOP_FOCUSED_CONTENT =
  "button.adw-top-section-button.ui-standard-button:focus-visible" +
  " > .ui-button-face > .adw-top-section-content";
// A focused standard button's label, which must outrank Kit's focused artwork opacity.
const STANDARD_FOCUSED_LABEL =
  'button.adw-standard-button.ui-standard-button:focus-visible > .ui-button-face > [aria-hidden="true"]';
// Kit's focused artwork opacity, which the opaque top-bar content must outrank.
const KIT_FOCUSED_ARTWORK =
  'button.ui-standard-button:focus-visible > .ui-button-face > [aria-hidden="true"]';

// A refusal's red phase on a standard button, a Settings or Cheats row and a choice card,
// whatever its state.
const REFUSING_BUTTON =
  '.adw-standard-button.ui-standard-button[data-refusal-red]:is(*, :focus-visible, [aria-disabled="true"])';
const REFUSING_ROW =
  ".adw-row:not(.adw-standard-button)[data-refusal-red]" +
  ":is(*,:focus-visible,[data-ui-pressed]:not([role=slider]))";
const CHOICE_OUTLINES = [
  ".adw-choice-group .adw-choice-option:focus-visible",
  ".adw-choice-pressed .adw-choice-option",
  ".adw-choice-held-outline",
] as const;
const REFUSING_CHOICE_GROUP = ".adw-choice-group[data-refusal-red]";
const REFUSING_CHOICE = `${REFUSING_CHOICE_GROUP} .adw-choice-refusal-band`;
const REFUSING_CHOICE_LABEL = `${REFUSING_CHOICE_GROUP} :is(.adw-choice-refusal-label, .adw-choice-refusal-label *)`;
// A refusal's red phase on a Start picker tile and a Pet shop row, focused or pressed alike.
const TILE_STATES =
  ":is(*, :focus-visible, .adw-picker-surface:not(:has(:focus-visible)) [data-picker-focused])";
const REFUSING_PICKER = `.adw-selection-tile[data-picker-refusing]${TILE_STATES}`;
const REFUSING_SHOP_ROW = `.adw-selection-tile[data-refusal-red]${TILE_STATES}`;
const REFUSING_TILE_INK =
  `.adw-selection-tile:is([data-picker-refusing], [data-refusal-red])${TILE_STATES}` +
  " :is(.adw-selection-focus-ink, .adw-selection-press-ink)";
const TILE_INKS = [".adw-selection-focus-ink", ".adw-selection-press-ink", "-press-ink)"];

// A focused or pressed Pet shop row, by Tab or by the Start picker.
const PLATE_STATES =
  ".adw-selection-tile:is(:focus-visible, [data-ui-pressed]," +
  " .adw-picker-surface:not(:has(:focus-visible)) [data-picker-focused])";

type Specificity = readonly [number, number, number];
const ranks = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
// A selector list's selectors, split at its top-level commas.
function selectors(list: string): string[] {
  const parts = [""];
  let depth = 0;
  for (const char of list) {
    depth += char === "(" ? 1 : char === ")" ? -1 : 0;
    if (char === "," && depth === 0) {
      parts.push("");
    } else {
      parts[parts.length - 1] += char;
    }
  }
  return parts;
}
// A complex selector's specificity: ids; classes, attributes and pseudo-classes; types and
// pseudo-elements. :is(), :not() and :has() count their most specific argument, :where() none.
function specificity(selector: string): Specificity {
  let sum: Specificity = [0, 0, 0];
  const add = ([a, b, c]: Specificity) => {
    sum = [sum[0] + a, sum[1] + b, sum[2] + c];
  };
  for (let at = 0; at < selector.length;) {
    const rest = selector.slice(at);
    const call = /^:(is|not|has|where)\(/.exec(rest);
    if (call !== null) {
      let end = call[0].length;
      for (let depth = 1; depth > 0; end += 1) {
        depth += rest[end] === "(" ? 1 : rest[end] === ")" ? -1 : 0;
      }
      if (call[1] !== "where") {
        add(
          selectors(rest.slice(call[0].length, end - 1))
            .map(specificity)
            .sort(ranks)
            .at(-1)!,
        );
      }
      at += end;
      continue;
    }
    const token = /^(?:#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+|[a-z][\w-]*|.)/i.exec(rest)![0];
    if (token.startsWith("#")) {
      add([1, 0, 0]);
    } else if (/^(?:\.|\[|:(?!:))/.test(token)) {
      add([0, 1, 0]);
    } else if (/^(?:::|[a-z])/i.test(token)) {
      add([0, 0, 1]);
    }
    at += token.length;
  }
  return sum;
}
// Each rule in sheet as its selectors and declarations, in order.
const rules = (sheet: string) =>
  [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(({ 1: list, 2: body, index }) =>
    selectors(list!).map((selector) => ({ body: body!, index, selector })),
  );

// The declarations of the first rule whose selector list holds selector.
function rule(sheet: string, selector: string): string {
  const found = rules(sheet).find((each) => each.selector === squeeze(selector));
  expect(found, selector).toBeDefined();
  return found!.body;
}

describe("control state cues", () => {
  it.each([
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
      "background-color:var(--ui-colour-button-pressed-face)",
    ],
    [
      "a Logbook row's and end-screen badge's 35% focus fill",
      "logbook",
      ":is(.adw-logbook-badge, .adw-end-badge-control)",
      "--ui-colour-button-focus-face:color-mix(in srgb,var(--adw-cyan) 35%,transparent);" +
        "--ui-colour-button-pressed-face:var(--ui-colour-button-focus-face);" +
        "--ui-button-focus-fill:var(--ui-colour-button-focus-face)",
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
      "color:var(--ui-colour-button-focus-text)!important",
    ],
    [
      "a focused Settings row's face",
      "ui",
      ".adw-row:focus-visible>.adw-row-face",
      "background-color:var(--ui-colour-button-focus-face)!important",
    ],
    [
      "a pressed Settings or Cheats switch row's face",
      "ui",
      '.adw-row:not([role=slider],[aria-disabled="true"],.adw-standard-button)[data-ui-pressed]>.adw-row-face',
      "background-color:var(--ui-colour-button-pressed-face)!important",
    ],
    [
      "a refused row's icon, a white silhouette on the dark red face",
      "ui",
      ".adw-row[data-refusal-red] .ui-form-row-icon>*",
      "filter:brightness(0)invert(1)",
    ],
    [
      "a focused or pressed row in forced colours",
      "uiForced",
      ".adw-row",
      "--ui-colour-button-focus-face:Highlight;--ui-colour-button-focus-text:HighlightText;" +
        "--ui-colour-button-pressed-face:Highlight;--ui-colour-button-pressed-text:HighlightText",
    ],
    [
      "a refusing standard button's dark red face over its focus",
      "gameNormal",
      REFUSING_BUTTON,
      "--adw-button-fill:var(--adw-darkRed)",
    ],
    [
      "a refusing row's dark red face over its focus",
      "uiNormal",
      `${REFUSING_ROW}>.adw-row-face`,
      "background-color:var(--adw-darkRed)!important",
    ],
    [
      "a refusing choice card's dark red band over its focus",
      "choiceNormal",
      REFUSING_CHOICE,
      "display:block;background:var(--adw-darkRed)",
    ],
    [
      "a refusing standard button's inverse face in forced colours",
      "gameForced",
      REFUSING_BUTTON,
      "--adw-button-fill:ButtonText;--adw-button-highlight:ButtonText;--adw-button-lip:ButtonText;" +
        "--adw-button-text:ButtonFace",
    ],
    [
      "a refusing choice card's inverse band in forced colours",
      "choiceForced",
      REFUSING_CHOICE,
      "forced-color-adjust:none;background:ButtonText",
    ],
    [
      "a refusing choice card's label in forced colours",
      "choiceForced",
      REFUSING_CHOICE_LABEL,
      "forced-color-adjust:none;color:ButtonFace!important",
    ],
    [
      "a refusing picker tile's name area in forced colours",
      "tileForced",
      `${REFUSING_PICKER} .adw-selection-focus-fill`,
      "background-color:Highlight!important;forced-color-adjust:none",
    ],
    [
      "a refusing Pet shop row's face in forced colours",
      "tileForced",
      `${REFUSING_SHOP_ROW} .adw-selection-face`,
      "background-color:Highlight!important;forced-color-adjust:none",
    ],
    [
      "a refusing Pet shop row's clear price plate in forced colours",
      "tileForced",
      `${REFUSING_SHOP_ROW} .adw-selection-plate`,
      "background-color:transparent!important;forced-color-adjust:none",
    ],
    [
      "a refusing Pet shop row's price in forced colours",
      "tileForced",
      `${REFUSING_SHOP_ROW} .adw-selection-plate-ink`,
      "color:HighlightText!important;forced-color-adjust:none",
    ],
    [
      "a refusing row's parts in the game's own forced colours",
      "uiForced",
      ".adw-row[data-refusal-red] *",
      "forced-color-adjust:none",
    ],
    [
      "a refusing row's inverse face in forced colours",
      "uiForced",
      `${REFUSING_ROW}>.adw-row-face`,
      "background-color:ButtonText!important",
    ],
    [
      "a refusing row's label in forced colours",
      "uiForced",
      `${REFUSING_ROW} .adw-text`,
      "color:ButtonFace!important",
    ],
    [
      "a refusing row's icon, a ButtonFace silhouette masked from its frame, in forced colours",
      "uiForced",
      ".adw-row[data-refusal-red] .ui-form-row-icon>*",
      "filter:none;background:ButtonFace!important;" +
        "mask:var(--adw-art-image)var(--adw-art-position)/var(--adw-art-size)",
    ],
    [
      "a content separator in forced colours",
      "uiForced",
      ".adw-separator",
      "forced-color-adjust:none;background-color:CanvasText!important",
    ],
    [
      "a pressed top-bar face",
      "top",
      ".adw-top-section-button[data-ui-pressed] .adw-top-section-fill",
      "var(--ui-colour-button-pressed-face)6.25%",
    ],
    [
      "a top-bar face's cyan focus and ink press",
      "top",
      ".adw-top-section-button",
      "--ui-colour-button-focus-face:var(--adw-cyan);--ui-colour-button-focus-text:var(--adw-ink);" +
        "--ui-colour-button-pressed-face:var(--adw-ink)",
    ],
    [
      "a top-bar face in forced colours",
      "topForced",
      ".adw-top-section-fill",
      "display:block;forced-color-adjust:none;background:ButtonFace",
    ],
    [
      "a focused top-bar face in forced colours",
      "topForced",
      ".adw-top-section-button:focus-visible .adw-top-section-fill",
      "background:var(--ui-colour-button-focus-face)",
    ],
    [
      "a pressed top-bar face in forced colours",
      "topForced",
      ".adw-top-section-button[data-ui-pressed] .adw-top-section-fill",
      "background:var(--ui-colour-button-pressed-face)",
    ],
    [
      "a top-bar face's focus and press in forced colours",
      "topForced",
      ".adw-top-section-button",
      "--ui-colour-button-focus-face:Highlight;--ui-colour-button-focus-text:HighlightText;" +
        "--ui-colour-button-pressed-face:Highlight",
    ],
    ["a focused top bar's SVG slot", "top", TOP_FOCUSED_CONTENT, "opacity:1"],
    [
      "a focused top bar's authored skin",
      "top",
      ".adw-top-section-button:focus-visible .adw-top-section-skin",
      "opacity:0.65",
    ],
    [
      "a resting top bar's glyph in forced colours",
      "topForced",
      ".adw-top-section-button",
      "--adw-top-glyph-ink:ButtonText",
    ],
    [
      "a focused or pressed top bar's glyph in forced colours",
      "topForced",
      ".adw-top-section-button:is(:focus-visible, [data-ui-pressed])",
      "--adw-top-glyph-ink:HighlightText",
    ],
    [
      "a disabled top bar's glyph in forced colours",
      "topForced",
      '.adw-top-section-button:is(:disabled, [aria-disabled="true"])',
      "--adw-top-glyph-ink:GrayText",
    ],
    [
      "a refusing top bar's glyph in forced colours",
      "topForced",
      ".adw-top-section-button[data-refusal-red]",
      "--adw-top-glyph-ink:ButtonFace",
    ],
    [
      "a top bar's glyph uses the selected system colour",
      "topForced",
      ".adw-top-section-glyph",
      "forced-color-adjust:none",
    ],
    [
      "a picker tile's or Pet shop row's cyan focus and green press under plum and ink",
      "tile",
      ".adw-selection-tile",
      "--ui-colour-button-focus-face:var(--adw-cyan);--ui-colour-button-focus-text:var(--adw-plum);" +
        "--ui-colour-button-pressed-face:var(--adw-green);--ui-colour-button-pressed-text:var(--adw-ink)",
    ],
    [
      "a pressed Pet shop row's text, an unaffordable one's included",
      "tile",
      ".adw-selection-tile[data-ui-pressed]:not([data-picker-refusing]):not(.adw-refusing)" +
        ":not(.adw-refusing-still) :is(.adw-selection-focus-ink, .adw-selection-press-ink)",
      "color:var(--ui-colour-button-pressed-text)!important",
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
      "color:var(--ui-colour-button-focus-text)!important;forced-color-adjust:none",
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
      "--adw-button-fill:var(--ui-colour-button-pressed-face)",
    ],
    [
      "a pressed or disabled standard button's sunk flat face",
      "game",
      '.adw-standard-button:is([data-ui-pressed], :disabled, [aria-disabled="true"]) .adw-standard-button-face',
      "background:linear-gradient(var(--adw-button-fill),var(--adw-button-fill));transform:translateY",
    ],
    [
      "a standard button's state colours",
      "game",
      ".adw-standard-button.ui-standard-button",
      "--ui-colour-button-disabled-face:var(--adw-neutralGrey);" +
        "--ui-colour-button-disabled-text:var(--adw-neutralDarkSlate);" +
        "--ui-colour-button-focus-face:var(--adw-cyan);--ui-colour-button-focus-text:var(--adw-ink);" +
        "--ui-colour-button-pressed-face:var(--adw-forest);" +
        "--ui-colour-button-pressed-text:var(--adw-white)",
    ],
    [
      "an unavailable standard button's navy focus under cream",
      "game",
      '.adw-standard-button[aria-disabled="true"]',
      "--ui-colour-button-focus-face:var(--adw-navy);--ui-colour-button-focus-text:var(--adw-cream)",
    ],
    [
      "a standard button's focus, press and selection in forced colours",
      "gameForced",
      ".adw-standard-button.ui-standard-button",
      "--ui-colour-button-focus-face:Highlight;--ui-colour-button-focus-text:HighlightText;" +
        "--ui-colour-button-pressed-face:Highlight;--ui-colour-button-pressed-text:HighlightText;" +
        "--ui-colour-button-selected-face:Highlight;--ui-colour-button-selected-text:HighlightText",
    ],
    [
      "a disabled standard button's label",
      "game",
      '.adw-standard-button:is(:disabled, [aria-disabled="true"])',
      "--adw-button-text:var(--ui-colour-button-disabled-text)",
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

  // Each control family sets its focus and press colours in Game Kit's theme state slots on its
  // root, once in normal and once in forced colours, and one rule reads each: every focus or press
  // rule that fills one of the family's parts reads a slot. The standard button's unavailable
  // focus is the one variant that sets its focus slots again.
  it.each([
    [
      "standard button, the Help pager's included",
      "game",
      ".adw-standard-button",
      true,
      "--adw-button-fill",
      [""],
    ],
    [
      "Settings or Cheats row or slider",
      "ui",
      ".adw-row",
      true,
      "background-color",
      [".adw-row-face"],
    ],
    [
      "picker tile or Pet shop row",
      "tile",
      ".adw-selection-tile",
      true,
      "background-color",
      [".adw-selection-face", ".adw-selection-focus-fill", ".adw-selection-focus-fill)"],
    ],
    ["slot sign", "tile", ".adw-slot-sign", false, "background-color", [".adw-slot-sign-focus"]],
    [
      "top-bar button",
      "top",
      ".adw-top-section-button",
      true,
      "background|--ui-button-focus-fill",
      [".adw-top-section-fill", ":focus-visible"],
    ],
    [
      "Logbook row or end-screen badge",
      "logbook",
      ":is(.adw-logbook-badge,.adw-end-badge-control)",
      true,
      "background-color",
      [".ui-button-face"],
    ],
    ["speech bubble", "ui", ".adw-button", false, "background-color", [".adw-speech-tail-focus)"]],
  ] as const)(
    "fills a %s from one focus slot and one press slot",
    (_what, sheet, scope, press, property, parts) => {
      const own = (text: string) =>
        rules(text).filter(({ selector }) => selector.startsWith(scope));
      const normal = own(unforced(SHEETS[sheet]));
      const forcedRules = own(forced(SHEETS[sheet]));
      const variants = sheet === "game" ? ['.adw-standard-button[aria-disabled="true"]'] : [];
      const count = (list: typeof normal, test: (body: string) => boolean) =>
        new Set(list.filter(({ body }) => test(body)).map(({ index }) => index)).size;
      for (const [slot, shown] of [
        ["focus", true],
        ["pressed", press],
      ] as const) {
        const declares = (body: string) => `;${body}`.includes(`;--ui-colour-button-${slot}-face:`);
        const reads = (body: string) => body.includes(`var(--ui-colour-button-${slot}-face)`);
        const roots = normal.filter(({ selector }) => !variants.includes(selector));
        expect(count(roots, declares), `${slot} slot`).toBe(shown ? 1 : 0);
        expect(count(forcedRules, declares), `forced ${slot} slot`).toBe(shown ? 1 : 0);
        expect(count(normal, reads), `${slot} fill`).toBe(shown ? 1 : 0);
        expect(count(forcedRules, reads), `forced ${slot} fill`).toBeLessThanOrEqual(1);
      }
      const fills = own(SHEETS[sheet])
        .filter(
          ({ selector }) =>
            /:focus-visible|\[data-picker-focused\]|\[data-ui-pressed\]|\.adw-choice-pressed/.test(
              selector,
            ) &&
            !/\[data-refusal-red\]|\[data-picker-refusing\]/.test(selector) &&
            parts.some((part) => selector.endsWith(part)),
        )
        .flatMap(({ body, selector }) =>
          [...`;${body}`.matchAll(new RegExp(`;(${property}):([^;]*)`, "g"))].map(
            ([, name, value]) => ({ name, selector, value }),
          ),
        );
      expect(fills.length).toBeGreaterThan(0);
      for (const { name, selector, value } of fills) {
        expect(value, `${selector} ${name}`).toContain("var(--ui-colour-button-");
      }
    },
  );

  it("draws the Help pager's buttons as standard buttons", () => {
    expect(squeeze(css("../../hud/dom/helpScreen.ts"))).toContain(
      'className:"adw-reset-buttonadw-standard-buttonadw-buttonadw-secondary"',
    );
  });

  it("keeps a focused standard button's label at full opacity over Kit's focused artwork", () => {
    expect(rule(SHEETS.game, STANDARD_FOCUSED_LABEL)).toContain("opacity:1");
    expect(
      ranks(specificity(STANDARD_FOCUSED_LABEL), specificity(KIT_FOCUSED_ARTWORK)),
    ).toBeGreaterThan(0);
  });

  // Each other rule in the sheet that sets the declaration on a part the selector ends with (a
  // focus, press, selection or disabled state) ranks below the red phase's rule or precedes it.
  // A forced-colours red phase is its last rule with that selector, ranked against the sheet's
  // normal-colour rules too, which apply in both.
  it.each([
    ["standard button's face", "gameNormal", REFUSING_BUTTON, "", "--adw-button-fill:"],
    [
      "row's face",
      "uiNormal",
      `${REFUSING_ROW}>.adw-row-face`,
      ".adw-row-face",
      "background-color:",
    ],
    ["row's label", "uiNormal", `${REFUSING_ROW} .adw-text`, ".adw-text", ";color:"],
    ["standard button's forced face", "game", REFUSING_BUTTON, "", "--adw-button-fill:"],
    [
      "row's forced face",
      "ui",
      `${REFUSING_ROW}>.adw-row-face`,
      ".adw-row-face",
      "background-color:",
    ],
    ["row's forced label", "ui", `${REFUSING_ROW} .adw-text`, ".adw-text", ";color:"],
    [
      "picker tile's name area",
      "tile",
      `${REFUSING_PICKER} .adw-selection-focus-fill`,
      ".adw-selection-focus-fill",
      "background-color:",
    ],
    [
      "Pet shop row's face",
      "tile",
      `${REFUSING_SHOP_ROW} .adw-selection-face`,
      ".adw-selection-face",
      "background-color:",
    ],
    [
      "Pet shop row's price plate",
      "tile",
      `${REFUSING_SHOP_ROW} .adw-selection-plate`,
      ".adw-selection-plate",
      "background-color:",
    ],
    [
      "picker tile's or Pet shop row's label and name",
      "tile",
      REFUSING_TILE_INK,
      TILE_INKS,
      ";color:",
    ],
    [
      "Pet shop row's price",
      "tile",
      `${REFUSING_SHOP_ROW} .adw-selection-plate-ink`,
      ".adw-selection-plate-ink",
      ";color:",
    ],
  ] as const)(
    "keeps a refusing %s over its other states",
    (_what, sheet, refusal, part, declaration) => {
      const all = rules(CUE_SHEETS[sheet]);
      const own = all.findLast(({ selector }) => selector === squeeze(refusal));
      expect(own, refusal).toBeDefined();
      const parts: readonly string[] = typeof part === "string" ? [part] : part;
      const rivals = all.filter(
        ({ body, selector }) =>
          selector !== own!.selector &&
          parts.some((end) => selector.endsWith(end)) &&
          `;${body}`.includes(declaration),
      );
      expect(rivals.length).toBeGreaterThan(0);
      for (const rival of rivals) {
        const rank = ranks(specificity(own!.selector), specificity(rival.selector));
        expect(rank > 0 || (rank === 0 && own!.index! > rival.index!), rival.selector).toBe(true);
      }
    },
  );

  it.each(CHOICE_OUTLINES)(
    "gives %s a flush cyan outline and a Highlight forced-colour outline",
    (selector) => {
      expect(rule(CUE_SHEETS.choiceNormal, selector)).toBe(
        "outline:var(--adw-slice-2)solidvar(--adw-cyan);outline-offset:0;",
      );
      expect(rule(CUE_SHEETS.choiceForced, selector)).toBe(
        "forced-color-adjust:none;outline-color:Highlight;",
      );
    },
  );

  it("keeps the choice refusal band independent of focus, press and held outlines", () => {
    expect(rule(CUE_SHEETS.choiceNormal, ".adw-choice-refusal-band")).toBe("display:none;");
    for (const sheet of [CUE_SHEETS.choiceNormal, CUE_SHEETS.choiceForced]) {
      const outlines = rules(sheet).filter(({ body }) => /(?:^|;)outline(?:-color)?:/.test(body));
      expect(outlines.map(({ selector }) => selector)).toEqual(CHOICE_OUTLINES.map(squeeze));
      expect(rule(sheet, REFUSING_CHOICE)).not.toMatch(/outline|--ui-colour-button/);
      expect(rule(sheet, REFUSING_CHOICE_LABEL)).not.toMatch(/outline|--ui-colour-button/);
    }
    const normal = rules(SHEETS.choice).find(
      ({ selector }) => selector === squeeze(REFUSING_CHOICE),
    )!;
    const override = rules(SHEETS.choice).findLast(
      ({ selector }) => selector === squeeze(REFUSING_CHOICE),
    )!;
    expect(override.index).toBeGreaterThan(normal.index!);
    expect(override.body).toContain("background:ButtonText");
  });

  it("outranks Kit's focused artwork opacity with the top-bar glyph slot", () => {
    expect(squeeze(KIT_CONTROLS)).toContain(`${squeeze(KIT_FOCUSED_ARTWORK)}{`);
    expect(specificity(KIT_FOCUSED_ARTWORK)).toEqual([0, 4, 1]);
    expect(
      ranks(specificity(TOP_FOCUSED_CONTENT), specificity(KIT_FOCUSED_ARTWORK)),
    ).toBeGreaterThan(0);
  });

  it("limits control outlines to choice cards and editable fields without focus rings", () => {
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
    // Choice cards retain their flush outline; editable fields retain native editing cues.
    expect([...rings, ...afterRings]).toEqual([
      "choice: .adw-choice-group.adw-choice-option:focus-visible," +
        ".adw-choice-pressed.adw-choice-option,.adw-choice-held-outline",
      "focus: .adw-rowinput:focus-visible",
      'gallery: .toolbar:is(select,input[type="search"]):focus-visible',
    ]);
  });

  it("fills the crash screen's focused Error details row cyan under ink through Kit's focus slots", () => {
    const summary = rule(squeeze(KIT_CRASH), ".crash-details summary:focus-visible");
    expect(summary).toContain("outline:none");
    expect(summary).toContain("background-color:var(--ui-colour-button-focus-face");
    expect(summary).toContain("color:var(--ui-colour-button-focus-text");
    const details = rule(SHEETS.crash, ".crash .crash-details");
    expect(details).toContain("--ui-colour-button-focus-face:var(--palette-cyan)");
    expect(details).toContain("--ui-colour-button-focus-text:var(--palette-ink)");
  });
});
