import { afterEach, expect, it, vi } from "vitest";

import { requiredAssets } from "./requiredAssets.ts";

afterEach(() => vi.unstubAllGlobals());
const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

it("keeps required decode failures explicit and retries failed images only", async () => {
  const attempts = new Map<string, number>();
  const images: { src: string; decode(): Promise<void> }[] = [];
  const doc = {
    createElement() {
      const image = {
        decode() {
          const count = (attempts.get(this.src) ?? 0) + 1;
          attempts.set(this.src, count);
          return this.src === "/bad.png" && count === 1
            ? Promise.reject(new Error("decode"))
            : Promise.resolve();
        },
        src: "",
      };
      images.push(image);
      return image;
    },
  } as unknown as Document;
  const changed = vi.fn();
  const assets = requiredAssets(doc, changed);
  assets.add([
    { kind: "image", url: "/good.png" },
    { kind: "image", url: "/bad.png" },
  ]);
  expect(assets.status()).toBe("loading");
  await settle();
  expect(assets.status()).toBe("failed");
  expect(assets.failed()).toEqual(["/bad.png"]);
  expect(assets.failedCuts()).toBe(false);
  assets.retry();
  await settle();
  expect(assets.status()).toBe("ready");
  expect(attempts).toEqual(
    new Map([
      ["/good.png", 1],
      ["/bad.png", 2],
    ]),
  );
  expect(images).toHaveLength(3);
});

it("rejects malformed required metadata and reuses the successful sheet cache on retry", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ json: () => ({ frames: {} }), ok: true })
    .mockResolvedValue({
      json: () => ({ keys: { a: { rect: [0, 0, 2, 2] } }, size: { h: 2, w: 2 } }),
      ok: true,
    });
  vi.stubGlobal("fetch", fetch);
  const assets = requiredAssets({} as Document, () => undefined);
  assets.add([{ kind: "sheet", url: "/required-retry-sheet.json" }]);
  await settle();
  expect(assets.failed()).toEqual(["/required-retry-sheet.json"]);
  assets.retry();
  await settle();
  expect(assets.status()).toBe("ready");
  assets.retry();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("reports failed cuts, cuts again on retry and ignores a late completion after disposal", async () => {
  let finish: () => void = () => undefined;
  const cut = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error("no canvas"))
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  const changed = vi.fn();
  const assets = requiredAssets({} as Document, changed, cut);
  assets.add([{ kind: "cuts", url: "dom-cuts" }]);
  await settle();
  expect(assets.failed()).toEqual(["dom-cuts"]);
  expect(assets.failedCuts()).toBe(true);
  assets.retry();
  expect(cut).toHaveBeenCalledTimes(2);
  const calls = changed.mock.calls.length;
  assets.dispose();
  finish();
  await settle();
  expect(changed).toHaveBeenCalledTimes(calls);
  assets.retry();
  expect(assets.failed()).toEqual([]);
});

it("notifies new loading registrations once before requests and tolerates reentrant deduplication and disposal", () => {
  const decode = vi.fn(() => Promise.resolve());
  const doc = { createElement: () => ({ decode, src: "" }) } as unknown as Document;
  const states: string[] = [];
  const descriptor = { kind: "image" as const, url: "/new-required.png" };
  const assets: ReturnType<typeof requiredAssets> = requiredAssets(doc, () => {
    states.push(assets.status());
    expect(decode).not.toHaveBeenCalled();
    assets.add([descriptor]);
    assets.dispose();
  });
  assets.add([descriptor]);
  expect(states).toEqual(["loading"]);
  expect(decode).not.toHaveBeenCalled();
  assets.add([{ kind: "image", url: "/after-disposal.png" }]);
  expect(states).toHaveLength(1);
});
