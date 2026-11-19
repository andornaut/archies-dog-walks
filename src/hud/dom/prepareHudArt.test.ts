import { expect, it, vi } from "vitest";

import { domArtFileUrl } from "../../assets/domArt.ts";
import { hudArtResources, prepareHudArt } from "./prepareHudArt.ts";

const artUrl = (path: string) => domArtFileUrl((file) => `/art/${file}`, path);

it("prepares modal art by its frames on its sheets and propagates required sheet failures", async () => {
  const source = { artUrl, loadSheet: vi.fn().mockResolvedValue({}) };
  await expect(
    prepareHudArt(source, [
      { key: "ui-panel", kind: "image" },
      { key: "fx-heart-loss", kind: "sheet" },
      { key: "ui-panel", kind: "image" },
    ]),
  ).resolves.toEqual(["/art/dom/dom-chrome.webp", "/art/dom/dom-walk.webp"]);
  expect(source.loadSheet.mock.calls).toEqual([
    ["/art/dom/dom-chrome.json#ui-panel"],
    ["/art/dom/dom-walk.json#fx-heart-loss"],
  ]);
  source.loadSheet.mockRejectedValueOnce(new Error("Required metadata unavailable"));
  await expect(prepareHudArt(source, [{ key: "fx-heart-loss", kind: "sheet" }])).rejects.toThrow(
    "Required metadata unavailable",
  );
});

it("declares each key's frames and each of its sheets' images once, without starting any load", () => {
  expect(
    hudArtResources({ artUrl }, [
      { key: "ui-panel", kind: "image" },
      { key: "fx-heart-loss", kind: "sheet" },
      { key: "ui-quip", kind: "image" },
    ]),
  ).toEqual([
    { kind: "sheet", url: "/art/dom/dom-chrome.json#ui-panel" },
    { kind: "image", url: "/art/dom/dom-chrome.webp" },
    { kind: "sheet", url: "/art/dom/dom-walk.json#fx-heart-loss" },
    { kind: "image", url: "/art/dom/dom-walk.webp" },
    { kind: "sheet", url: "/art/dom/dom-chrome.json#ui-quip" },
  ]);
});
