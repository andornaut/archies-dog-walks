import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { expect, it, vi } from "vitest";

import { HOME_LAYOUT } from "../../home/index.ts";
import { dogTiles, homeTargetAt, nativeTarget, rosterOrder, targetId } from "./targets.ts";

const centre = ({ height, width, x, y }: Rect) => [x + width / 2, y + height / 2] as const;

it("shares picker targets with native input and keeps yard hit priority", () => {
  const shop = HOME_LAYOUT.petShop.hit;
  const sign = HOME_LAYOUT.slotSign.hit;
  const state = {
    bubbleHits: [shop, sign],
    exit: false,
    naming: vi.fn(() => true),
    signShown: vi.fn(() => true),
  };
  const dog = homeTargetAt(state, ...centre(dogTiles()[0]!));
  expect(dog).toEqual({ dog: rosterOrder()[0], kind: "dog" });
  expect(nativeTarget(targetId(dog!))).toEqual(dog);
  expect(state.signShown).not.toHaveBeenCalled();
  expect(state.naming).not.toHaveBeenCalled();
  expect(homeTargetAt(state, ...centre(sign))).toEqual({ kind: "slotSign" });
  expect(state.naming).not.toHaveBeenCalled();

  state.signShown.mockReturnValue(false);
  expect(homeTargetAt(state, ...centre(shop))).toEqual({ kind: "bubble" });
  state.naming.mockReturnValue(false);
  expect(homeTargetAt(state, ...centre(shop))).toEqual({ kind: "petShop" });
});
