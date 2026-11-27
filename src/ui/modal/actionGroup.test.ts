import { expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../../testing/fontInk.ts";
import { BUTTON_SIZE } from "../buttonGeometry.ts";
import { arrangePanelActions } from "./actionGroup.ts";
import { modalActionWidth } from "./layout.ts";
import { modalTitleInk } from "./titleRole.ts";
import { panelButton } from "./view.ts";

const measure = {
  inkWidth: (_font: "body" | "title", text: string) => inkWidth("font-title", { scale: 2 }, text),
  title: fontFileMetrics("font-title"),
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
};
const panel = { height: 300, width: 328, x: 16, y: 100 };
const labels = [gameData.runText.homeQuestion.keepWalking, gameData.runText.homeQuestion.headHome];
const buttons = labels.map((label, index) =>
  panelButton(
    measure,
    {
      height: 48,
      width: modalActionWidth(measure.inkWidth("title", label)),
      x: 40,
      y: 170 + index * 64,
    },
    index === 0,
    label,
  ),
);

it("stacks the safe primary last with equal widths, hits and original action identities", () => {
  const result = arrangePanelActions(measure, panel, "stack", buttons);
  expect(result.map(({ label }) => label)).toEqual([labels[1], labels[0]]);
  expect(result.map(({ primary }) => primary)).toEqual([false, true]);
  expect(result.map(({ actionIndex }) => actionIndex)).toEqual([1, 0]);
  const width = Math.max(
    ...labels.map((label) => modalActionWidth(measure.inkWidth("title", label))),
  );
  expect(result.map(({ rect }) => rect.width)).toEqual([width, width]);
  // A stack starts at the first button's row, the stack gap apart (arrangeActions).
  const top = buttons[0]!.rect.y;
  expect(result.map(({ rect }) => rect.y)).toEqual([top, top + 48 + BUTTON_SIZE.stackGap]);
  for (const button of result) {
    expect(button.hit).toEqual(button.rect);
    expect(button.text.centreX).toBe(panel.x + panel.width / 2);
  }
  const only = arrangePanelActions(measure, panel, "stack", [buttons[1]!]);
  expect(only[0]!.rect.width).toBe(modalActionWidth(measure.inkWidth("title", labels[1]!)));
});

it("does not reserve the widest action after it leaves the visible group", () => {
  const widestFirst = [...buttons].sort(
    (a, b) => measure.inkWidth("title", b.text.text) - measure.inkWidth("title", a.text.text),
  );
  const visible = widestFirst.slice(1);
  const result = arrangePanelActions(measure, panel, "stack", visible);
  expect(result[0]!.rect.width).toBe(
    modalActionWidth(measure.inkWidth("title", visible[0]!.text.text)),
  );
});

it("places the same primary rightmost in a horizontal action group", () => {
  const short = [gameData.homeText.shop.confirmBuy, gameData.homeText.shop.confirmCancel].map(
    (label, index) => panelButton(measure, buttons[index]!.rect, index === 0, label),
  );
  const row = arrangePanelActions(measure, SCREEN_LAYOUT.screen, "row", short);
  expect(row.map(({ actionIndex }) => actionIndex)).toEqual([1, 0]);
  expect(row[0]!.rect.y).toBe(row[1]!.rect.y);
  expect(row[0]!.rect.x + row[0]!.rect.width + BUTTON_SIZE.gap).toBe(row[1]!.rect.x);
  expect(row[1]!.primary).toBe(true);
});
