import { EventEmitter } from "node:events";

import { inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { sceneStub } from "@andornaut/game-kit/test/phaser/sceneStub";
import type { GameObjects, Scene } from "phaser";
import { describe, expect, it, vi } from "vitest";

import { debuffIconKey } from "../../assets/iconKeys.ts";
import { gameData, ZONE_BANNER } from "../../data/index.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import type { ZoneId } from "../../data/types.ts";
import { zoneBannerHeading } from "../../hud/zoneCelebration.ts";
import type { RunState } from "../../state/runState.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { liveSwitchRuns } from "../../testing/liveSwitch.ts";
import { fadeAway } from "../uiKit.ts";
import { popUpArt, showDebuffPopup, ZoneBanner } from "./roadBanners.ts";
import { DEPTH } from "./stage.ts";

vi.mock("phaser", () => ({
  Core: { Events: { PRE_RENDER: "prerender" } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
}));

vi.mock("../uiKit.ts", () => ({ fadeAway: vi.fn() }));

// Use the authored font metrics and the stub's bitmap text draw calls.
vi.mock("../../ui/phaser/pixelText.ts", () => ({
  addPixelText: (scene: Scene, x: number, y: number, text: string) =>
    scene.add.bitmapText(x, y, "title", text),
  pixelBitmapFont: () => gameFont("font-title"),
}));
vi.mock("../../ui/phaser/displayText.ts", () => ({
  addDisplayText: (scene: Scene, x: number, y: number, text: string) =>
    scene.add.bitmapText(x, y, "display", text),
  displayBitmapFont: () => gameFont("font-display"),
  hasDisplayFont: () => true,
}));

class Image extends EventEmitter {
  active = true;
  depth = 0;
  displayHeight = 16;
  displayWidth = 16;
  x = 0;
  y = 0;
  destroy() {
    this.active = false;
    this.emit("destroy");
  }
  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }
  setOrigin() {
    return this;
  }
  setScale(scale: number) {
    this.displayHeight *= scale;
    this.displayWidth *= scale;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
}

function fixture() {
  const images: Image[] = [];
  const image = vi.fn(() => {
    const added = new Image();
    images.push(added);
    return added;
  });
  const scene = sceneStub(vi.fn, { add: { image }, textures: { exists: () => true } });
  return { image, images, scene: scene as unknown as Scene };
}

describe("received effect popups", () => {
  it("uses the shared bare-icon popup at a fixed lead-top snapshot with a one-second stationary fade", () => {
    const { image, images, scene } = fixture();
    const lead = { x: 180, y: 400 };
    showDebuffPopup(scene, lead, "muddy");
    expect(image).toHaveBeenCalledWith(0, 0, debuffIconKey("muddy"));
    const popup = images[0];
    expect(popup).toMatchObject({
      depth: DEPTH.popup,
      displayHeight: 32,
      displayWidth: 32,
      x: 164,
      y: 364,
    });
    expect(fadeAway).toHaveBeenLastCalledWith(scene, [popup], { ms: 1000, rise: 0 });
    lead.x = 300;
    lead.y = 450;
    expect(popup).toMatchObject({ x: 164, y: 364 });
  });

  it("separates distinct kinds within the viewport and replaces an older popup of the same kind", () => {
    const { images, scene } = fixture();
    const lead = { x: SCREEN_CONFIG.width - 2, y: 400 };
    for (const kind of ["muddy", "stinky", "spotlight", "zoomies"] as const) {
      showDebuffPopup(scene, lead, kind);
    }
    expect(images.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 328, y: 364 },
      { x: 328, y: 328 },
      { x: 328, y: 292 },
      { x: 328, y: 256 },
    ]);
    showDebuffPopup(scene, lead, "muddy");
    expect(images[0]?.active).toBe(false);
    expect(images[4]).toMatchObject({ x: 328, y: 364 });
  });

  it("preserves the existing pickup defaults", () => {
    const { images, scene } = fixture();
    popUpArt(scene, { at: { x: 180, y: 400 }, key: "gear", scale: 2 }, false);
    expect(fadeAway).toHaveBeenLastCalledWith(scene, images, { ms: 1800, rise: 16 });
  });
});

describe("zone banner", () => {
  const zoneName = (zone: ZoneId) => gameData.world.zones.find(({ id }) => id === zone)!.name;

  // The texts of the banners still up: their heading, then the neighbourhood's name.
  const shownTexts = (scene: Scene) =>
    scene.children.list.flatMap((object) =>
      object.type === "Container"
        ? [
            (object as unknown as { list: { text: string; type: string }[] }).list.flatMap(
              ({ text, type }) => (type === "BitmapText" ? [text] : []),
            ),
          ]
        : [],
    );

  const bannerScene = () =>
    sceneStub(vi.fn, {
      textures: { exists: () => true },
      tweens: { chain: vi.fn() },
    }) as unknown as Scene;

  it("enlarges the entry heading and keeps the widest authored name inside the banner face", () => {
    const font = gameFont("font-display");
    const width = (name: string) => inkWidth(font, 1, name.toUpperCase());
    const widest = gameData.world.zones.reduce((best, zone) =>
      width(zone.name) > width(best.name) ? zone : best,
    );
    const scene = bannerScene();
    const banner = new ZoneBanner(scene);
    const run = liveSwitchRuns(["highPark"], widest.id, "cabbagetown").switched;
    banner.show(run, true);
    const container = scene.children.list.find(
      (object): object is GameObjects.Container => object.type === "Container",
    )!;
    const [heading, name] = container.list.filter(
      (object): object is GameObjects.BitmapText => object.type === "BitmapText",
    );
    expect(heading?.scaleX).toBe(ZONE_BANNER.headingFace.scale);
    expect(name?.scaleX).toBeGreaterThan(1);
    const inkWidthAtScale = (width(widest.name) + 2) * name!.scaleX;
    expect(inkWidthAtScale).toBeLessThanOrEqual(ZONE_BANNER.nameFace.inkRoom);
  });

  // A live switch keeps the walk's slot, so the banner names the chosen neighbourhood there, then
  // the next zone's, and a resumed walk's banner names the chosen one again.
  it.each([
    { next: "cabbagetown", route: ["highPark"], zone: "theBeaches" },
    { next: "kensingtonMarket", route: ["highPark", "cabbagetown"], zone: "yongeStreet" },
  ] satisfies { next: ZoneId; route: ZoneId[]; zone: ZoneId }[])(
    "names $zone in slot $route.length after a switch from $route, then $next",
    ({ next, route, zone }) => {
      const runs = liveSwitchRuns(route, zone, next);
      const expected = (zoneIndex: number, id: ZoneId) => [
        [zoneBannerHeading(gameData, { zoneIndex }), zoneName(id)],
      ];
      const scene = bannerScene();
      const banner = new ZoneBanner(scene);
      const walked: RunState = { ...runs.switched, route };
      banner.show(walked, true);
      expect(shownTexts(scene)).toEqual(expected(route.length - 1, route.at(-1)!));
      banner.show(runs.switched, true);
      expect(shownTexts(scene)).toEqual(expected(route.length - 1, zone));
      banner.show(runs.next, true);
      expect(shownTexts(scene)).toEqual(expected(route.length, next));
      const resumed = bannerScene();
      new ZoneBanner(resumed).show(runs.resumed, true);
      expect(shownTexts(resumed)).toEqual(expected(route.length - 1, zone));
    },
  );
});
