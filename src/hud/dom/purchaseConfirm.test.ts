import { fontMetrics } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import type { ConfirmChoice } from "../../home/purchaseConfirm.ts";
import { purchaseConfirmCardView } from "../../home/purchaseConfirmCardView.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { showPurchaseConfirm } from "./purchaseConfirm.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const MEASURE = {
  art: () => ({ height: 64, width: 64 }),
  body: fontMetrics(fonts.body),
  bodyWidth: () => 40,
  hasTag: () => false,
  inkWidth: () => 40,
  title: fontMetrics(fonts.title),
  wrapBody: (_width: number, text: string) => [text],
  wrapNote: (_width: number, text: string) => [text],
};
const LINES = { buy: "Buy", cancel: "Cancel", left: "$5 left after", price: "$20", title: "Buy?" };

function confirm(pressed: ConfirmChoice | undefined) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
  const buy = vi.fn();
  const cancel = vi.fn();
  showPurchaseConfirm(layer, {
    artUrl: (path) => path,
    buy,
    cancel,
    closeLabel: gameData.menuText.common.close,
    fonts,
    loadSheet: () => Promise.resolve({}),
    pillColours: () => undefined,
    toGame: (point) => point,
    view: purchaseConfirmCardView(MEASURE, {
      lines: LINES,
      picture: { key: "portrait-dog-archie", scale: 1 },
      pressed,
    }),
  });
  const nodes = element.children[0]?.all() ?? [];
  return { buy, cancel, nodes };
}

describe("the HTML purchase confirm", () => {
  it("draws Cancel in the secondary look and Buy as the go button, each pressing its answer", () => {
    const { buy, cancel, nodes } = confirm(undefined);
    const buttons = nodes.filter((node) => node.tagName === "button");
    expect(buttons.map(({ className }) => className)).toEqual([
      "adw-button adw-secondary",
      "adw-button adw-go",
      "adw-close",
    ]);
    buttons.forEach((button) => button.fire("click", {}));
    expect(buy).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["cancel", ["adw-button adw-secondary"]],
    ["buy", ["adw-button adw-go"]],
    [undefined, []],
  ] as const)("shows %s pressed as a key's dip says", (pressed, shown) => {
    const { nodes } = confirm(pressed);
    expect(
      nodes.filter((node) => node.attributes.has("data-pressed")).map((node) => node.className),
    ).toEqual(shown);
  });
});
