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
// The rules inside a sheet's forced-colours blocks, in order.
function forced(sheet: string): string {
  const head = "@media(forced-colors:active){";
  const blocks: string[] = [];
  for (let at = sheet.indexOf(head); at >= 0; at = sheet.indexOf(head, at + 1)) {
    let end = at + head.length;
    for (let depth = 1; depth > 0; end += 1) {
      depth += sheet[end] === "{" ? 1 : sheet[end] === "}" ? -1 : 0;
    }
    blocks.push(sheet.slice(at + head.length, end - 1));
  }
  return blocks.join("");
}
const CUE_SHEETS = {
  ...SHEETS,
  gameForced: forced(SHEETS.game),
  tileForced: forced(SHEETS.tile),
  topForced: forced(SHEETS.top),
  uiForced: forced(SHEETS.ui),
};

const FORCED_TOP_ARTWORK =
  "button.adw-top-section-button.ui-standard-button:is(:focus-visible, [data-ui-pressed])" +
  ' > .ui-button-face > [aria-hidden="true"]';
// A focused standard button's label, which must outrank Kit's focused artwork opacity.
const STANDARD_FOCUSED_LABEL =
  'button.adw-standard-button.ui-standard-button:focus-visible > .ui-button-face > [aria-hidden="true"]';
// Kit's focused artwork opacity, which the forced-colours top-bar artwork must outrank.
const KIT_FOCUSED_ARTWORK =
  'button.ui-standard-button:focus-visible > .ui-button-face > [aria-hidden="true"]';

// A refusal's red phase on a standard button and on a Settings or Cheats row, whatever its state.
const REFUSING_BUTTON =
  '.adw-standard-button.ui-standard-button[data-refusal-red]:is(*, :focus-visible, [aria-disabled="true"])';
const REFUSING_ROW =
  ".adw-row:not(.adw-standard-button):is([data-refusal-red],[data-ui-refusal-red])" +
  ":is(*,:focus-visible,[data-ui-pressed]:not([role=slider]))";

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
      '.adw-choice-pressed:has(.adw-choice-option:not([aria-disabled="true"])) .adw-choice-press-band',
      "background:var(--adw-green)",
    ],
    [
      "a focused or pressed choice label in forced colours",
      "choice",
      '.adw-choice-pressed:has(.adw-choice-option:not([aria-disabled="true"])) .adw-choice-press-label *',
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
      "a refusing standard button's inverse face in forced colours",
      "gameForced",
      REFUSING_BUTTON,
      "--adw-button-fill:ButtonText;--adw-button-highlight:ButtonText;--adw-button-lip:ButtonText;" +
        "--adw-button-text:ButtonFace",
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
      ".adw-row:is([data-refusal-red],[data-ui-refusal-red]) .ui-form-row-icon>*",
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

  // Each other forced-colours rule that sets the declaration on the part the selector ends with
  // (a focus, press, selection or disabled state) ranks below the red phase's rule or precedes it.
  it.each([
    ["standard button's face", "gameForced", REFUSING_BUTTON, "", "--adw-button-fill:"],
    [
      "row's face",
      "uiForced",
      `${REFUSING_ROW}>.adw-row-face`,
      ".adw-row-face",
      "background-color:",
    ],
    ["row's label", "uiForced", `${REFUSING_ROW} .adw-text`, ".adw-text", ";color:"],
  ] as const)(
    "keeps a refusing %s inverse over its other forced-colours states",
    (_what, sheet, refusal, part, declaration) => {
      const all = rules(CUE_SHEETS[sheet]);
      const own = all.find(({ selector }) => selector === squeeze(refusal));
      expect(own, refusal).toBeDefined();
      const rivals = all.filter(
        ({ body, selector }) =>
          selector !== own!.selector && selector.endsWith(part) && `;${body}`.includes(declaration),
      );
      expect(rivals.length).toBeGreaterThan(0);
      for (const rival of rivals) {
        const rank = ranks(specificity(own!.selector), specificity(rival.selector));
        expect(rank > 0 || (rank === 0 && own!.index! > rival.index!), rival.selector).toBe(true);
      }
    },
  );

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
