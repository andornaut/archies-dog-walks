import { type GameObjects, type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import {
  createNativeTopSection,
  type NativeTopSection,
  type NativeTopSectionConfig,
} from "../ui/dom/nativeTopSection.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { PALETTE } from "../ui/palette.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import {
  addPixelText,
  inkSpan,
  pixelBitmapFont,
  scalePixelText,
  setPixelText,
} from "../ui/phaser/pixelText.ts";
import { topBarRects } from "../ui/topBarTrim.ts";
import { type TopSectionButton, topSectionCurrency, topSectionLayout } from "../ui/topSection.ts";
import { addHtmlMirror, type HtmlMirror } from "./htmlMirror.ts";
import {
  addIconButton,
  type IconButton,
  imageIconOr,
  setDollarAmount,
  soundIcon,
} from "./uiKit.ts";

export interface TopSection {
  readonly buttons: ReadonlyMap<TopSectionButton, IconButton>;
  readonly root: GameObjects.Container;
  setAmount(full: string, short?: string): void;
  setMuted(muted: boolean): void;
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
  let muted = config.muted === true;
  const glyphs = new Map<TopSectionButton, { root: GameObjects.Container; x: number; y: number }>();
  const drawIcon = (id: TopSectionButton, x: number, y: number): ReturnType<typeof imageIconOr> => {
    switch (id) {
      case "help":
        return imageIconOr(scene, "icon-help", x, y, "?");
      case "mute":
        return soundIcon(scene, !muted, x, y);
      case "menu": {
        if (scene.textures.exists("icon-menu")) {
          return imageIconOr(scene, "icon-menu", x, y, "");
        }
        const g = scene.add.graphics();
        for (const dy of [4, 8, 12]) {
          fillRect(g, PALETTE.cream, { height: 2, width: 12, x: x + 2, y: y + dy });
        }
        return [g];
      }
      case "pause": {
        if (paused) {
          return drawIcon("menu", x, y);
        }
        if (scene.textures.exists("icon-pause")) {
          return imageIconOr(scene, "icon-pause", x, y, "");
        }
        const g = scene.add.graphics();
        for (const dx of [4, 9]) {
          fillRect(g, PALETTE.cream, { height: 10, width: 3, x: x + dx, y: y + 4 });
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
  // A paused owner no longer advances its press animation. Its lit controls release at once.
  const releasePressed = () => buttons.forEach((button) => button.setPressed(false));
  scene.events.on(Scenes.Events.PAUSE, releasePressed);
  root.once("destroy", () => scene.events.off(Scenes.Events.PAUSE, releasePressed));
  if (config.heading !== undefined) {
    const { scale, x, y } = layout.heading;
    const text = config.heading;
    root.add(
      addPixelText(scene, x, y, text, {
        colour: PALETTE.cream,
        font: "title",
        originX: 0.5,
        scale,
      }),
    );
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
    setMuted(value) {
      if (muted === value) {
        return;
      }
      muted = value;
      const glyph = glyphs.get("mute");
      if (glyph !== undefined) {
        glyph.root.removeAll(true);
        glyph.root.add(drawIcon("mute", glyph.x, glyph.y));
      }
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

const nativeSections = new WeakMap<Scene, NativeTopSection>();

// The shared native section owns chrome and native presses; the scene owns action admission.
export function addNativeTopSection(
  scene: Scene,
  config: NativeTopSectionConfig,
): NativeTopSection | undefined {
  nativeSections.get(scene)?.dispose();
  const layer = uiLayer();
  const title = pixelBitmapFont(scene, "title");
  if (layer === undefined || title === undefined) {
    return undefined;
  }
  const view = createNativeTopSection(layer, { artUrl, loadSheet }, title, config);
  const release = () => view.buttons.forEach((button) => button.setPressed(false));
  const section: NativeTopSection = {
    ...view,
    dispose() {
      if (nativeSections.get(scene) !== section) {
        return;
      }
      nativeSections.delete(scene);
      scene.events.off(Scenes.Events.PAUSE, release);
      scene.events.off(Scenes.Events.SHUTDOWN, section.dispose);
      view.dispose();
    },
  };
  nativeSections.set(scene, section);
  scene.events.on(Scenes.Events.PAUSE, release);
  scene.events.once(Scenes.Events.SHUTDOWN, section.dispose);
  return section;
}
