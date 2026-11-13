import { fontMetrics } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { helpView } from "../../help/helpView.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { showHelpScreen } from "./helpScreen.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const MEASURE = {
  body: fontMetrics(fonts.body),
  inkWidth: () => 40,
  title: fontMetrics(fonts.title),
  titleInkBottom: () => fontMetrics(fonts.title).inkBottom,
  wrapBody: (_scale: number, _width: number, text: string) => [text],
  wrapNote: (_width: number, text: string) => [text],
};

function helpScreen(page: number, pressed: "close" | "next" | "previous" | undefined) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
  const shown = showHelpScreen(layer, {
    closeLabel: gameData.menuText.common.close,
    fonts,
    toGame: (point) => point,
    view: helpView(gameData, MEASURE, page, pressed),
  });
  const [dialog] = element.children;
  return { dialog, doc, nodes: dialog?.all() ?? [], shown };
}

describe("the HTML help screen", () => {
  it("takes no presses: its page buttons are pictures and Tab keeps focus on it", () => {
    const { dialog, doc, nodes } = helpScreen(0, undefined);
    expect(dialog?.className).toContain("adw-passive");
    const title = nodes.find((node) => node.id === dialog?.getAttribute("aria-labelledby"));
    expect(title?.getAttribute("aria-label")).toBe(gameData.menuText.help.heading);
    expect(nodes.some((node) => node.tagName === "button")).toBe(false);
    dialog?.fire("keydown", { code: "Tab", preventDefault: () => undefined, shiftKey: false });
    expect(doc.activeElement).toBe(dialog);
    const page = nodes.find((node) => node.id === dialog?.getAttribute("aria-describedby"));
    const spoken = page?.all().filter((node) => node.className === "adw-spoken");
    expect(spoken?.map(({ textContent }) => textContent)[0]).toBe(gameData.help[0]?.title);
  });

  it.each([
    ["previous", 0, []],
    ["previous", 1, ["adw-button"]],
    ["next", 0, ["adw-button adw-go"]],
    ["close", 0, []],
  ] as const)("shows %s pressed on page %d only where it is available", (pressed, page, shown) => {
    const { nodes } = helpScreen(page, pressed);
    expect(
      nodes.filter((node) => node.attributes.has("data-pressed")).map((node) => node.className),
    ).toEqual(shown);
    expect(nodes.some((node) => node.className === "adw-close")).toBe(false);
    const previous = nodes.find((node) => node.className.startsWith("adw-button"));
    expect(previous?.className.includes("adw-disabled")).toBe(page === 0);
  });

  it("refuses a button once at a time: a shake, or a still red label under reduced motion", () => {
    const refusal = { flashMs: 80, flashes: 4, shake: 3, shakeMs: 40 };
    for (const reducedMotion of [false, true]) {
      const { nodes, shown } = helpScreen(0, undefined);
      const previous = nodes.find((node) => node.className.startsWith("adw-button"));
      shown.refuse(0, { ...refusal, reducedMotion });
      shown.refuse(0, { ...refusal, reducedMotion: !reducedMotion });
      expect(previous?.className).toContain(reducedMotion ? "adw-refusing-still" : "adw-refusing");
      expect(
        previous?.classList.contains(reducedMotion ? "adw-refusing" : "adw-refusing-still"),
      ).toBe(false);
    }
  });
});
