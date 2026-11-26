import { type Point, type Rect, rectAboveIn, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { domArtUrl } from "../../assets/files/index.ts";
import { debuffIconKey, gearIconKey } from "../../assets/index.ts";
import type { DebuffId, EncounterId, GearId } from "../../data/ids.ts";
import { gameData, SCREEN_CONFIG, ZONE_BANNER } from "../../data/index.ts";
import { zoneBannerHeading } from "../../hud/index.ts";
import { currentZone } from "../../rules/index.ts";
import type { RunState } from "../../state/index.ts";
import { mountRoadBanner } from "../../ui/dom/roadBanner.ts";
import { loadSheet } from "../../ui/dom/sheetFrames.ts";
import { uiLayer } from "../../ui/dom/uiLayer.ts";
import { PALETTE } from "../../ui/index.ts";
import { addDisplayText, displayBitmapFont, hasDisplayFont } from "../../ui/phaser/displayText.ts";
import { fillRect } from "../../ui/phaser/draw.ts";
import { addPixelText, pixelBitmapFont } from "../../ui/phaser/pixelText.ts";
import { fadeAway } from "../uiKit.ts";
import { DEPTH, LAYOUT } from "./stage.ts";

// A pickup's art pops up over where it was grabbed, its bottom lift pixels over that point, then
// floats rise pixels up as it fades.
const POPUP = { fadeMs: 1800, lift: 4, rise: 16 };
const GEAR_POPUP_SCALE = 2;
const BANNER = { holdMs: 1800, key: "ui-zone-banner", slideMs: 300 };
const { plate: PLATE } = ZONE_BANNER;
const ART_SOURCE = { artUrl: domArtUrl, loadSheet };

// How long the zone banner shows, from sliding in to leaving.
export function zoneBannerMs(still: boolean): number {
  return (still ? 0 : BANNER.slideMs) + BANNER.holdMs + BANNER.slideMs;
}

// An instant lucky find opens no card: its art pops up over where it was grabbed, at, then
// floats up and fades while the walk goes on. With reduced motion it fades in place.
export function showInstantPopup(
  scene: Scene,
  encounter: EncounterId,
  at: Point,
  still: boolean,
): void {
  const { resolution } = gameData.encounters[encounter];
  if (resolution.kind !== "instant" || !scene.textures.exists(resolution.art)) {
    return;
  }
  popUpArt(scene, { at, key: resolution.art, scale: 1 }, still);
}

// A gear drop grabbed pops up as a lucky find does: the item's shop art at 2x, as the explain
// card draws it.
export function showGearPopup(scene: Scene, gear: GearId, at: Point, still: boolean): void {
  const key = gearIconKey(gear);
  if (!scene.textures.exists(key)) {
    return;
  }
  popUpArt(scene, { at, key, scale: GEAR_POPUP_SCALE }, still);
}

// Art at scale centred over at, its bottom POPUP.lift over it, kept on screen as it floats up as
// it fades, or as it fades in place when still.
export function popUpArt(
  scene: Scene,
  art: {
    at: Point;
    avoid?: readonly Rect[];
    fadeMs?: number;
    key: string;
    rise?: number;
    scale: number;
  },
  still: boolean,
): GameObjects.Image {
  const rise = still ? 0 : (art.rise ?? POPUP.rise);
  const image = scene.add
    .image(0, 0, art.key)
    .setOrigin(0)
    .setScale(art.scale)
    .setDepth(DEPTH.popup);
  const { height, width } = SCREEN_CONFIG;
  const view = { height: height - rise, width, x: 0, y: rise };
  const size = { height: image.displayHeight, width: image.displayWidth };
  const bottom = Math.round(art.at.y) - POPUP.lift;
  const occupied = art.avoid ?? [];
  const bottoms = [bottom, ...occupied.map((rect) => rect.y - POPUP.lift)];
  const columns = [
    art.at.x,
    ...occupied.flatMap((rect) => [
      rect.x - POPUP.lift - size.width / 2,
      rect.x + rect.width + POPUP.lift + size.width / 2,
    ]),
  ];
  const candidates = [
    ...bottoms.map((row) => ({ bottom: row, x: art.at.x })),
    ...columns.slice(1).map((x) => ({ bottom, x })),
  ].map((at) => rectAboveIn(view, at, size));
  const place =
    candidates.find((candidate) =>
      occupied.every(
        (rect) =>
          !rectsOverlap(
            {
              height: rect.height + 2 * POPUP.lift,
              width: rect.width + 2 * POPUP.lift,
              x: rect.x - POPUP.lift,
              y: rect.y - POPUP.lift,
            },
            candidate,
          ),
      ),
    ) ?? candidates[0];
  if (place !== undefined) {
    image.setPosition(place.x, place.y);
  }
  fadeAway(scene, [image], { ms: art.fadeMs ?? POPUP.fadeMs, rise });
  return image;
}

const debuffPopups = new WeakMap<Scene, Map<DebuffId, GameObjects.Image>>();

// A received effect uses the shared pickup popup, fixed above the lead dog's snapshot position.
export function showDebuffPopup(scene: Scene, leadTop: Point, debuff: DebuffId): void {
  const key = debuffIconKey(debuff);
  if (!scene.textures.exists(key)) {
    return;
  }
  const active = debuffPopups.get(scene) ?? new Map<DebuffId, GameObjects.Image>();
  active.get(debuff)?.destroy();
  const avoid = [...active.values()].map((image) => ({
    height: image.displayHeight,
    width: image.displayWidth,
    x: image.x,
    y: image.y,
  }));
  const image = popUpArt(
    scene,
    {
      at: { ...leadTop },
      avoid,
      fadeMs: 1000,
      key,
      rise: 0,
      scale: 2,
    },
    true,
  );
  active.set(debuff, image);
  debuffPopups.set(scene, active);
  image.once("destroy", () => {
    if (active.get(debuff) === image) {
      active.delete(debuff);
    }
    if (active.size === 0) {
      debuffPopups.delete(scene);
    }
  });
}

// The zone banner's heading ("Toronto, neighbourhood 2") and the zone's name, slid in over
// the road at each zone's start, a live neighbourhood switch's included: each show replaces the
// banner still up with the run's current slot and neighbourhood.
export class ZoneBanner {
  private banner: GameObjects.Container | undefined;
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  show(run: RunState, still: boolean): void {
    const { scene } = this;
    this.banner?.destroy();
    const zone = currentZone(gameData, run);
    const { road } = LAYOUT;
    const x = road.x + Math.floor((road.width - PLATE.width) / 2);
    const banner = scene.add.container(x, road.y + ZONE_BANNER.y).setDepth(DEPTH.banner);
    if (scene.textures.exists(BANNER.key)) {
      banner.add(scene.add.image(0, 0, BANNER.key).setOrigin(0));
    } else {
      const g = scene.add.graphics();
      fillRect(g, PALETTE.cream, { ...PLATE, x: 0, y: 0 });
      banner.add(g);
    }
    const heading = zoneBannerHeading(gameData, run);
    banner.add(
      addPixelText(scene, PLATE.width / 2, 11, heading, {
        colour: PALETTE.plum,
        font: "title",
        originX: 0.5,
      }),
    );
    banner.add(
      addDisplayText(scene, PLATE.width / 2, 27, zone.name, {
        colour: PALETTE.plum,
        font: "title",
        originX: 0.5,
        scale: 2,
      }),
    );
    this.banner = banner;
    if (!still) {
      banner.x = x - road.width;
    }
    this.mountDom(banner, heading, zone.name);
    scene.tweens.chain({
      onComplete: () => banner.destroy(),
      targets: banner,
      tweens: [
        { duration: still ? 0 : BANNER.slideMs, ease: "Sine.easeOut", x },
        {
          delay: BANNER.holdMs,
          duration: BANNER.slideMs,
          ...(still ? { alpha: 0 } : { x: x + road.width }),
        },
      ],
    });
  }

  private mountDom(banner: GameObjects.Container, heading: string, name: string): void {
    const { scene } = this;
    const layer = uiLayer();
    const title = pixelBitmapFont(scene, "title");
    if (layer === undefined || title === undefined) {
      return;
    }
    const display = hasDisplayFont(scene, name) ? displayBitmapFont(scene) : undefined;
    const view = mountRoadBanner(layer, ART_SOURCE, {
      heading,
      name,
      nameFont: {
        bitmap: display ?? title,
        font: display === undefined ? "title" : "display",
        scale: display === undefined ? 2 : 1,
      },
      pose: () => banner,
      shown: (ready) => banner.setVisible(!ready),
      title,
    });
    const update = () => view.update();
    const destroy = () => banner.destroy();
    scene.game.events.on(Core.Events.PRE_RENDER, update);
    scene.events.once(Scenes.Events.SHUTDOWN, destroy);
    banner.once("destroy", () => {
      view.destroy();
      scene.game.events.off(Core.Events.PRE_RENDER, update);
      scene.events.off(Scenes.Events.SHUTDOWN, destroy);
    });
  }
}
