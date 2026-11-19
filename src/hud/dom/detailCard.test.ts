import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { artPart } from "./detailCard.ts";

it("keeps art hidden, and settles, where its frames are not a sheet's", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const part = artPart(
    new FakeDocument() as unknown as Document,
    { artUrl: (path) => `/art/${path}`, loadSheet: () => Promise.resolve({}) },
    { key: "ui-detail-well", scale: 1, size: { height: 68, width: 68 }, x: 0, y: 0 },
  );
  await expect(part.ready).resolves.toEqual(["/art/images/ui-detail-well.png"]);
  expect(part.element.style.visibility).toBe("hidden");
  expect(error).toHaveBeenCalledOnce();
  error.mockRestore();
});
