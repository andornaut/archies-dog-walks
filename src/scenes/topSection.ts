import type { GameObjects, Scene } from "phaser";

import { PALETTE } from "../ui/palette.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import { addPixelText, inkSpan, scalePixelText, setPixelText } from "../ui/phaser/pixelText.ts";
import { topBarRects } from "../ui/topBarTrim.ts";
import { type TopSectionButton, topSectionCurrency, topSectionLayout } from "../ui/topSection.ts";
import { addHtmlMirror, type HtmlMirror } from "./htmlMirror.ts";
import {
  addIconButton,
  exitIcon,
  type IconButton,
  imageIconOr,
  setDollarAmount,
  settingsIcon,
  soundIcon,
} from "./uiKit.ts";

export interface TopSection {
  readonly buttons: ReadonlyMap<TopSectionButton, IconButton>;
  readonly root: GameObjects.Container;
  setAmount(full: string, short?: string): void;
  setPaused(paused: boolean): void;
}

// One chrome, control and currency renderer. Callers supply visible sections and live values,
// while their existing input owners retain every binding and overlay guard.
export function addTopSection(
  scene: Scene,
  config: {
    buttons: readonly TopSectionButton[];
    currency?: boolean;
    effects?: number;
    heading?: string;
    muted?: boolean;
  },
): TopSection {
  const layout = topSectionLayout(config.buttons, {
    ...(config.currency === undefined ? {} : { currency: config.currency }),
    ...(config.effects === undefined ? {} : { effects: config.effects }),
  });
  const root = scene.add.container(0, 0);
  root.setData("topSection", true);
  const chrome = scene.add.graphics();
  root.add(chrome);
  topBarRects(layout.bar).forEach(({ colour, rect }) => fillRect(chrome, PALETTE[colour], rect));
  for (const well of layout.effectWells) {
    if (scene.textures.exists("ui-effect-well")) {
      root.add(scene.add.image(well.x, well.y, "ui-effect-well").setOrigin(0));
    } else {
      fillRect(chrome, PALETTE.ink, well);
    }
  }
  const buttons = new Map<TopSectionButton, IconButton>();
  let paused = false;
  const glyphs = new Map<TopSectionButton, { root: GameObjects.Container; x: number; y: number }>();
  const drawIcon = (id: TopSectionButton, x: number, y: number): ReturnType<typeof imageIconOr> => {
    switch (id) {
      case "close":
        return imageIconOr(scene, "icon-close", x, y, "X");
      case "exit":
        return exitIcon(scene, x, y);
      case "help":
        return imageIconOr(scene, "icon-help", x, y, "?");
      case "logbook":
        return imageIconOr(scene, "icon-logbook", x, y, "L");
      case "mute":
        return soundIcon(scene, config.muted !== true, x, y);
      case "settings":
        return settingsIcon(scene, x, y);
      case "pause": {
        const key = paused ? "icon-play" : "icon-pause";
        if (scene.textures.exists(key)) {
          return imageIconOr(scene, key, x, y, "");
        }
        const g = scene.add.graphics();
        if (paused) {
          [10, 8, 8, 6, 6, 4, 2, 2].forEach((height, i) =>
            fillRect(g, PALETTE.cream, { height, width: 1, x: x + 4 + i, y: y + 9 - height / 2 }),
          );
        } else {
          for (const dx of [4, 9]) {
            fillRect(g, PALETTE.cream, { height: 10, width: 3, x: x + dx, y: y + 4 });
          }
        }
        return [g];
      }
      default:
        return id satisfies never;
    }
  };
  for (const [id, { face }] of layout.controls) {
    buttons.set(
      id,
      addIconButton(scene, root, face.x, face.y, (x, y) => {
        const glyph = scene.add.container(0, 0, drawIcon(id, x, y));
        glyphs.set(id, { root: glyph, x, y });
        return [glyph];
      }),
    );
  }
  if (config.heading !== undefined) {
    const { scale, x, y } = layout.heading;
    const text = config.heading;
    root.add(addPixelText(scene, x, y, text, { colour: PALETTE.cream, font: "title", scale }));
  }
  const currency = scene.add.container(0, 0);
  root.add(currency);
  const dollar = config.currency
    ? addPixelText(scene, 0, 0, "$", { colour: PALETTE.amber, font: "title" })
    : undefined;
  const amount = config.currency
    ? addPixelText(scene, 0, 0, "", { colour: PALETTE.cream, font: "title" })
    : undefined;
  if (dollar !== undefined && amount !== undefined) {
    root.add([dollar, amount]);
  }
  let shown: string | undefined;
  return {
    buttons,
    root,
    setAmount(full, short = full) {
      if (dollar === undefined || amount === undefined) {
        return;
      }
      const value = `${full}\0${short}`;
      if (value === shown) {
        return;
      }
      shown = value;
      const { room, scale } = topSectionCurrency(layout, 0);
      const widthOf = (text: string) => {
        setPixelText(amount, text);
        scalePixelText(amount, 1, 0, 0);
        const ink = inkSpan(amount);
        return ink.right - ink.left;
      };
      const text = widthOf(`$${full}`) * scale <= room ? full : short;
      const placement = topSectionCurrency(layout, widthOf(`$${text}`) * scale);
      const rect = placement.well;
      const width = rect.width;
      currency.removeAll(true);
      const keys = [
        "ui-home-cash-well-left",
        "ui-home-cash-well-mid",
        "ui-home-cash-well-right",
      ] as const;
      if (keys.every((key) => scene.textures.exists(key))) {
        currency.add([
          scene.add.image(rect.x, rect.y, keys[0]).setOrigin(0),
          scene.add
            .image(rect.x + 1, rect.y, keys[1])
            .setOrigin(0)
            .setScale(width - 2, 1),
          scene.add.image(rect.x + width - 1, rect.y, keys[2]).setOrigin(0),
        ]);
      } else {
        const g = scene.add.graphics();
        currency.add(g);
        fillRect(g, PALETTE.ink, rect);
      }
      setDollarAmount(dollar, amount, text, () => placement);
    },
    setPaused(value) {
      if (paused === value) {
        return;
      }
      paused = value;
      const glyph = glyphs.get("pause");
      if (glyph !== undefined) {
        glyph.root.removeAll(true);
        glyph.root.add(drawIcon("pause", glyph.x, glyph.y));
      }
    },
  };
}

// This undimmed section retains the same art-pixel renderer while its scene is paused below
// a modal. The screen beneath keeps its existing canvas snapshot and dim lifecycle.
export function mirrorTopSection(
  scene: Scene,
  root: () => GameObjects.Container | undefined,
  covered: () => boolean = () => false,
): HtmlMirror | undefined {
  return addHtmlMirror(
    scene,
    () => {
      const bar = root();
      return bar === undefined ? [] : [bar];
    },
    covered,
    { whilePaused: true },
  );
}
