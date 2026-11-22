import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import type { ConfirmChoice } from "../../home/purchaseConfirm.ts";
import { purchaseConfirmCardView } from "../../home/purchaseConfirmCardView.ts";
import { FakeDocument, fakeLayer, layerViews } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { showPurchaseConfirm } from "./purchaseConfirm.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const MEASURE = {
  art: () => ({ height: 64, width: 64 }),
  body: fontMetrics(fonts.body),
  bodyWidth: () => 40,
  hasTag: () => false,
  inkWidth: () => 40,
  title: fontMetrics(fonts.title),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
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
    loadSheet: async (path) => ownArtFrames(path),
    pillColours: () => undefined,
    toGame: (point) => point,
    view: purchaseConfirmCardView(MEASURE, {
      lines: LINES,
      picture: { key: "portrait-dog-archie", scale: 1 },
      pressed,
    }),
  });
  const nodes = layerViews(element)[0]?.all() ?? [];
  return { buy, cancel, nodes };
}

describe("the HTML purchase confirm", () => {
  it("draws Cancel in the secondary look and Buy as the go button, each pressing its answer", () => {
    const { buy, cancel, nodes } = confirm(undefined);
    const buttons = nodes.filter((node) => node.tagName === "button");
    expect(buttons.map((button) => button.getAttribute("data-ui-button-role"))).toEqual([
      "secondary",
      "primary",
      "navigation",
    ]);
    const labelledActions = buttons
      .filter((button) => button.className.includes("adw-button"))
      .map((button) => button.getAttribute("aria-label"));
    expect(labelledActions).toEqual([LINES.cancel, LINES.buy]);
    expect(labelledActions).not.toContain(gameData.menuText.common.close);
    expect(buttons[2]!.getAttribute("aria-label")).toBe(gameData.menuText.common.close);

    buttons[0]!.fire("click", {});
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(buy).not.toHaveBeenCalled();
    buttons[1]!.fire("click", {});
    expect(buy).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    buttons[2]!.fire("click", {});
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(buy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["cancel", ["secondary"]],
    ["buy", ["primary"]],
    [undefined, []],
  ] as const)("shows %s pressed as a key's dip says", (pressed, shown) => {
    const { nodes } = confirm(pressed);
    expect(
      nodes
        .filter((node) => node.attributes.has("data-ui-pressed"))
        .map((node) => node.getAttribute("data-ui-button-role")),
    ).toEqual(shown);
  });
});
