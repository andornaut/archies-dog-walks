import { expect, it } from "vitest";

import { domScale } from "../domScale.ts";
import { sliceParts } from "./sliceParts.ts";

it("cuts a nine-slice into whole-art-pixel corners and edges round a stretched middle", () => {
  const scale = domScale(2, { height: 0, width: 360, x: 0, y: 0 });
  const parts = sliceParts(
    scale,
    { height: 40, width: 100 },
    { height: 12, width: 12 },
    { bottom: 4, left: 4, right: 4, top: 4 },
  );
  expect(parts).toHaveLength(9);
  expect(parts[0]).toEqual({
    box: { height: 8, left: 0, top: 0, width: 8 },
    from: { height: 4, width: 4, x: 0, y: 0 },
  });
  expect(parts[4]).toEqual({
    box: { height: 24, left: 8, top: 8, width: 84 },
    from: { height: 4, width: 4, x: 4, y: 4 },
  });
  // A three-slice has no columns at its sides.
  expect(
    sliceParts(
      scale,
      { height: 40, width: 8 },
      { height: 9, width: 8 },
      { bottom: 3, left: 0, right: 0, top: 3 },
    ),
  ).toHaveLength(3);
});
