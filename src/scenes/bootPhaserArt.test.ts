import { readFileSync } from "node:fs";

import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import { beforeEach, expect, it, vi } from "vitest";

import { parseManifest, type SpriteAsset } from "../assets/manifest.ts";
import { usesPhaserArt } from "../assets/phaserArt.ts";
import { BootScene } from "./BootScene.ts";
import { ensurePlaceholder, measureSprite } from "./sprites.ts";

const native = vi.hoisted(() => ({ requireAssets: vi.fn() }));
vi.mock("phaser", () => ({
  GameObjects: { BitmapText: { ParseFromAtlas: vi.fn() } },
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));
vi.mock("virtual:art-files", () => ({ default: new Map() }));
vi.mock("../ui/dom/uiLayer.ts", () => ({ uiLayer: () => native }));
vi.mock("../assets/phaser/manifestArt.ts", async (original) => ({
  ...(await original<typeof import("../assets/phaser/manifestArt.ts")>()),
  addAtlasFonts: vi.fn(),
  addAtlasTextures: vi.fn(),
  smoothDepthArt: vi.fn(),
}));
vi.mock("./sprites.ts", async (original) => ({
  ...(await original<typeof import("./sprites.ts")>()),
  ensurePlaceholder: vi.fn(),
  measureSprite: vi.fn(),
}));

const manifest = parseManifest(JSON.parse(readFileSync("public/art/manifest.json", "utf8")));
const methods = BootScene.prototype as unknown as {
  processAssets(include: (key: string) => boolean, budget: number, done: () => void): void;
  registerSprite(sprite: SpriteAsset): void;
  requireNativeUi(keys: ReadonlySet<string>, ready: () => void): void;
};
beforeEach(() => vi.clearAllMocks());

it("does not create animations for native chrome even when a prior texture is already present", () => {
  const stub = sceneStub(vi.fn, { textures: { exists: () => true } });
  const nativeSprites = manifest.sprites.filter(({ key }) => !usesPhaserArt(key));
  expect(nativeSprites).toHaveLength(1);
  nativeSprites.forEach((sprite) => methods.registerSprite.call(stub, sprite));
  expect(stub.anims.create).not.toHaveBeenCalled();
  expect(stub.cache.json.get).not.toHaveBeenCalled();
  const world = manifest.sprites.find(({ key }) => key === "ui-tile")!;
  stub.cache.json.add(world.key, JSON.parse(readFileSync(`public/art/${world.json}`, "utf8")));
  methods.registerSprite.call(stub, world);
  expect(stub.anims.create).toHaveBeenCalled();
  expect(measureSprite).toHaveBeenCalledExactlyOnceWith(stub, world.key, world.anchor);
});

it("leaves native sprites out of Boot processing while preserving non-native fallback creation", () => {
  const stub = sceneStub(vi.fn);
  const registerSprite = vi.fn();
  Object.assign(stub, { manifest, registerSprite });
  const done = vi.fn();
  methods.processAssets.call(stub, () => true, Number.POSITIVE_INFINITY, done);
  expect(done).toHaveBeenCalledOnce();
  expect(registerSprite.mock.calls.length).toBeGreaterThan(0);
  expect(
    registerSprite.mock.calls.every(([sprite]) => usesPhaserArt((sprite as SpriteAsset).key)),
  ).toBe(true);
  expect(vi.mocked(ensurePlaceholder).mock.calls.length).toBeGreaterThan(0);
  expect(vi.mocked(ensurePlaceholder).mock.calls.every(([, key]) => usesPhaserArt(key))).toBe(true);
});

it("still requires all eight native keys' frames and their sheet's image before Home admission", () => {
  const stub = sceneStub(vi.fn);
  const keys = new Set(
    [...manifest.images, ...manifest.sprites]
      .map(({ key }) => key)
      .filter((key) => !usesPhaserArt(key)),
  );
  const wait = vi.fn(() => () => undefined);
  Object.assign(stub, { manifest, nativeUi: { wait } });
  methods.requireNativeUi.call(stub, keys, vi.fn());
  expect(keys.size).toBe(8);
  expect(wait).toHaveBeenCalledOnce();
  const resources = native.requireAssets.mock.calls[0]![0] as { kind: string; url: string }[];
  expect(resources.map(({ kind, url }) => [kind, url.replace(/^.*\/art\//, "")]).sort()).toEqual(
    [
      ["image", "dom/dom-chrome.webp"],
      ...[...keys].map((key) => ["sheet", `dom/dom-chrome.json#${key}`]),
    ].sort(),
  );
});
