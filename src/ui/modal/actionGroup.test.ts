import { expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { fontFileMetrics, inkWidth } from "../../testing/fontInk.ts";
import { BUTTON_SIZE } from "../buttonGeometry.ts";
import { arrangePanelActions } from "./actionGroup.ts";
import { dismissFooter } from "./dismissFooter.ts";
import { MODAL, modalActionWidth } from "./layout.ts";
import { panelButton } from "./view.ts";

const measure = {
  inkWidth: (_font: "body" | "title", text: string) => inkWidth("font-title", { scale: 2 }, text),
  title: fontFileMetrics("font-title"),
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

it("places the existing safe primary last with equal widths, hits and original action identities", () => {
  const result = arrangePanelActions(measure, panel, "column", { buttons });
  expect(result.buttons.map(({ label }) => label)).toEqual([labels[1], labels[0]]);
  expect(result.buttons.map(({ primary }) => primary)).toEqual([false, true]);
  expect(result.buttons.map(({ actionIndex }) => actionIndex)).toEqual([1, 0]);
  const width = Math.max(
    ...labels.map((label) => modalActionWidth(measure.inkWidth("title", label))),
  );
  expect(result.buttons.map(({ rect }) => rect.width)).toEqual([width, width]);
  expect(result.buttons.map(({ rect }) => rect.y)).toEqual(buttons.map(({ rect }) => rect.y));
  for (const button of result.buttons) {
    expect(button.hit).toEqual(button.rect);
    expect(button.text.centreX).toBe(panel.x + panel.width / 2);
  }
  const only = arrangePanelActions(measure, panel, "column", { buttons: [buttons[1]!] });
  expect(only.buttons[0]!.rect.width).toBe(modalActionWidth(measure.inkWidth("title", labels[1]!)));
});

it("includes a visible dismissal in the same column above its existing safe primary", () => {
  const footer = dismissFooter(
    measure,
    { label: gameData.menuText.common.close, primary: false },
    panel,
  );
  const result = arrangePanelActions(measure, panel, "column", { buttons, footer });
  const column = [...result.buttons, result.footer!].sort((a, b) => a.rect.y - b.rect.y);
  expect(column.map(({ primary }) => primary)).toEqual([false, false, true]);
  expect(column.map(({ rect }) => rect.width)).toEqual(Array(3).fill(column[0]!.rect.width));
  expect(result.footer!.label).toBe(footer.label);
  expect(result.buttons.at(-1)!.label).toBe(labels[0]);
  expect(column.at(-1)!.rect.y + 48 + MODAL.pad).toBe(panel.y + panel.height);
});

it("places the same primary rightmost in a horizontal action group", () => {
  const row = arrangePanelActions(measure, SCREEN_LAYOUT.screen, "row", { buttons });
  expect(row.buttons.map(({ actionIndex }) => actionIndex)).toEqual([1, 0]);
  expect(row.buttons[0]!.rect.y).toBe(row.buttons[1]!.rect.y);
  expect(row.buttons[0]!.rect.x + row.buttons[0]!.rect.width + BUTTON_SIZE.gap).toBe(
    row.buttons[1]!.rect.x,
  );
  expect(row.buttons[1]!.primary).toBe(true);
});
