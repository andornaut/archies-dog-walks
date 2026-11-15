import { expect, it, vi } from "vitest";

import { hudArtResources, prepareHudArt } from "./prepareHudArt.ts";

it("prepares modal art without probing image metadata and propagates required sheet failures", async () => {
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    loadSheet: vi.fn().mockResolvedValue({}),
  };
  await expect(
    prepareHudArt(source, [
      { key: "ui-panel", kind: "image" },
      { key: "fx-heart-loss", kind: "sheet" },
      { key: "ui-panel", kind: "image" },
    ]),
  ).resolves.toEqual([
    "/art/images/ui-panel.png",
    "/art/images/ui-panel-dim.png",
    "/art/sprites/fx-heart-loss.png",
  ]);
  expect(source.loadSheet).toHaveBeenCalledExactlyOnceWith("/art/sprites/fx-heart-loss.json");
  source.loadSheet.mockRejectedValueOnce(new Error("Required metadata unavailable"));
  await expect(prepareHudArt(source, [{ key: "fx-heart-loss", kind: "sheet" }])).rejects.toThrow(
    "Required metadata unavailable",
  );
});

it("declares required base, dim and metadata resources without starting any load", () => {
  expect(
    hudArtResources({ artUrl: (path) => `/art/${path}` }, [
      { key: "ui-panel", kind: "image" },
      { key: "fx-heart-loss", kind: "sheet" },
      { key: "ui-panel", kind: "image" },
    ]),
  ).toEqual([
    { kind: "image", url: "/art/images/ui-panel.png" },
    { kind: "image", url: "/art/images/ui-panel-dim.png" },
    { kind: "sheet", url: "/art/sprites/fx-heart-loss.json" },
    { kind: "image", url: "/art/sprites/fx-heart-loss.png" },
  ]);
});
