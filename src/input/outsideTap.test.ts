import { expect, it } from "vitest";

import { SCREEN_LAYOUT } from "../data/screen";
import { screenArea } from "./outsideTap";

it("uses the logical game screen and retains the covered overlay regions", () => {
  const covered = [{ height: 40, width: 40, x: 30, y: 30 }];
  const area = screenArea(covered);
  expect(area).toEqual({ bounds: SCREEN_LAYOUT.screen, covered });
});
