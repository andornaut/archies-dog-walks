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
      json: () => ({
        frames: { a: { frame: { h: 2, w: 2, x: 0, y: 0 } } },
        meta: { size: { h: 2, w: 2 } },
      }),
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

it("reports manifest failures and ignores a late completion after disposal", async () => {
  let finish: (value: unknown) => void = () => undefined;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({ json: () => ({ sprites: [] }), ok: true })
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
  );
  const changed = vi.fn();
  const assets = requiredAssets({ baseURI: "https://example.test/" } as Document, changed);
  assets.add([{ kind: "button-manifest", url: "/buttons.json" }]);
  await settle();
  expect(assets.failed()).toEqual(["/buttons.json"]);
  assets.retry();
  const calls = changed.mock.calls.length;
  assets.dispose();
  finish({ ok: false });
  await settle();
  expect(changed).toHaveBeenCalledTimes(calls);
  assets.retry();
  expect(assets.failed()).toEqual([]);
});

it("resolves the required skin manifest against its build URL and waits for its sheets and images", async () => {
  const pngs: string[] = [];
  const doc = {
    baseURI: "https://example.test/game/",
    createElement() {
      return {
        decode() {
          pngs.push(this.src);
          return Promise.resolve();
        },
        src: "",
      };
    },
  } as unknown as Document;
  const manifest = {
    sprites: ["ui-button", "ui-icon-button"].map((key) => ({
      json: `art/${key}.json`,
      key,
      png: `art/${key}.png`,
    })),
  };
  const sheet = {
    frames: { normal: { frame: { h: 20, w: 20, x: 0, y: 0 } } },
    meta: { size: { h: 20, w: 20 } },
  };
  const fetch = vi.fn((url: string) =>
    Promise.resolve({ json: () => (url.endsWith("skin.json") ? manifest : sheet), ok: true }),
  );
  vi.stubGlobal("fetch", fetch);
  const assets = requiredAssets(doc, () => undefined);
  assets.add([{ kind: "button-manifest", url: "assets/skin.json" }]);
  await settle();
  expect(assets.status()).toBe("ready");
  expect(pngs).toEqual([
    "https://example.test/game/assets/art/ui-button.png",
    "https://example.test/game/assets/art/ui-icon-button.png",
  ]);
  expect(fetch).toHaveBeenCalledTimes(3);
});
