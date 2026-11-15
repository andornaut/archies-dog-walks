import type { Point, Rect } from "@andornaut/game-kit/rect";
import { type BitmapFont, fontMetrics, laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";

import { domArtPath } from "../../assets/domArt.ts";
import { ownerCardFaceKey } from "../../assets/spriteKeys.ts";
import { gameData } from "../../data/index.ts";
import { SLICES } from "../../data/layout.ts";
import {
  type DomArtSource,
  imageArt,
  imageNineSlice,
  sheetArt,
  sheetNineSlice,
} from "../../ui/dom/artElements.ts";
import { boundsAdvance, type DomTextBlock, placeBox, shownText } from "../../ui/dom/pixelLine.ts";
import { playingFrame, sheetTagFrames, type TagFrame } from "../../ui/dom/sheetFrames.ts";
import { textBlock } from "../../ui/dom/textBlock.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale, gridTransform, gridX, gridY } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import type { FaceBox, FaceRow } from "../faceText.ts";
export interface HudMomentState {
  x: number;
  y: number;
  alpha: number;
  scale: number;
  visible: boolean;
}
export type HudMomentClock = "now" | "momentNow" | "firingNow";
export interface HudMomentTime {
  now: number;
  momentNow: number;
  firingNow: number;
}
export interface MomentArt {
  key: string;
  clock?: HudMomentClock;
  // A fixed frame within the selected tag, zero-based, used only with still.
  frameIndex?: number;
  at: Point;
  tags?: readonly string[];
  scale?: number;
  origin?: Point;
  loop?: boolean;
  still?: boolean;
  last?: boolean;
  image?: {
    width: number;
    height: number;
  };
  onFrame?: (index: number) => void;
  onComplete?: () => void;
}
export interface HudArtPlayback {
  readonly ready: Promise<readonly TagFrame[]>;
  dispose(): void;
}
export interface HudMoment {
  readonly state: HudMomentState;
  readonly element: HTMLElement;
  art(art: MomentArt): HudArtPlayback;
  panel(
    rect: Rect,
    key?: string,
    colours?: {
      border: number;
      fill: number;
    },
    corner?: number,
  ): void;
  ring(rect: Rect, colour: number, width: number): void;
  text(text: DomTextBlock): void;
  faceRows(
    at: {
      capsTop: number;
      x: number;
    },
    box: FaceBox | undefined,
    scale: number,
    colour: number,
    rows: readonly FaceRow[],
  ): void;
  dispose(): void;
}
export interface HudMomentPainter {
  readonly element: HTMLElement;
  readonly fonts: Readonly<Record<"body" | "title" | "display", BitmapFont>>;
  hasArt(key: string): boolean;
  prepare(
    assets: readonly {
      key: string;
      kind: "image" | "sheet";
    }[],
  ): Promise<readonly string[]>;
  width(scale: number, text: string): number;
  inkWidth(scale: number, text: string): number;
  group(depth: number, clock?: HudMomentClock): HudMoment;
  update(time: HudMomentTime): void;
  dispose(): void;
}
const ORIGIN = { x: 0, y: 0 };
const hex = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
// Scene clocks own lifetimes and tweens. This painter owns only native pixels and asset readiness.
export function createHudMoments(
  layer: UiLayer,
  source: DomArtSource,
  fonts: HudMomentPainter["fonts"],
  hasArt: (key: string) => boolean,
  pillColours: (index: number) =>
    | {
        name: number;
        pill: number;
      }
    | undefined,
): HudMomentPainter {
  const doc = layer.element.ownerDocument;
  const surface = doc.createElement("div");
  surface.className = "adw-dialog";
  surface.style.pointerEvents = "none";
  surface.style.isolation = "isolate";
  layer.element.append(surface);
  const roots = new Set<() => void>();
  const views = new Set<(scale: DomScale) => void>();
  let time: HudMomentTime = { firingNow: 0, momentNow: 0, now: 0 };
  let alive = true;
  const paint = () => views.forEach((draw) => draw(layer.scale()));
  const offScale = layer.onScale(paint);
  const offReady = layer.onReady(paint);
  const group = (depth: number, clock: HudMomentClock = "momentNow"): HudMoment => {
    const element = doc.createElement("div");
    element.className = "adw-lines";
    element.style.pointerEvents = "none";
    element.style.zIndex = String(depth);
    surface.append(element);
    const state: HudMomentState = { alpha: 1, scale: 1, visible: true, x: 0, y: 0 };
    const draws: ((scale: DomScale) => void)[] = [];
    const reveals: {
      cancel(): void;
    }[] = [];
    let disposed = false;
    const draw = (scale: DomScale) => {
      if (disposed) {
        return;
      }
      element.style.display = state.visible && alive && layer.ready() ? "" : "none";
      element.style.opacity = String(state.alpha);
      element.style.transformOrigin = "0 0";
      const dx = gridX(scale, state.x) - gridX(scale, 0);
      const dy = gridY(scale, state.y) - gridY(scale, 0);
      const translate = `translate(${dx}px, ${dy}px)`;
      element.style.transform = `${gridTransform(scale)} ${translate} scale(${state.scale})`;
      draws.forEach((part) => part(scale));
    };
    views.add(draw);
    const mount = (
      node: HTMLElement,
      urls: Promise<readonly string[]>,
      place: (scale: DomScale) => void,
    ) => {
      element.append(node);
      const reveal = layer.reveal(urls, node);
      reveals.push(reveal);
      draws.push(place);
      draw(layer.scale());
      return () => {
        reveal.cancel();
        const index = draws.indexOf(place);
        if (index !== -1) {
          draws.splice(index, 1);
        }
        node.remove();
      };
    };
    const api: HudMoment = {
      art(art) {
        if (!hasArt(art.key)) {
          return { dispose() {}, ready: Promise.resolve([]) };
        }
        if (art.image !== undefined) {
          const image = imageArt(doc, source, art.key);
          const unmount = mount(image.element, image.ready, (scale) =>
            image.place(scale, ORIGIN, { ...art.at, ...art.image! }),
          );
          return { dispose: unmount, ready: Promise.resolve([]) };
        }
        const sheet = sheetArt(doc, source, art.key);
        let frames: TagFrame[] = [];
        const artClock = art.clock ?? clock;
        const began = time[artClock];
        let completed = false;
        let previousFrame = -1;
        let removed = false;
        const ready = source
          .loadSheet(source.artUrl(domArtPath("sheet", art.key, "json")))
          .then((json) => {
            for (const tag of art.tags ?? ["idle"]) {
              frames = sheetTagFrames(json, tag);
              if (frames.length > 0) {
                break;
              }
            }
            paint();
            return frames;
          });
        const unmount = mount(
          sheet.element,
          ready.then(() => sheet.ready),
          (scale) => {
            if (removed) {
              return;
            }
            const duration = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
            const elapsed = Math.max(0, time[artClock] - began);
            const index = art.still
              ? (art.frameIndex ?? (art.last ? frames.length - 1 : 0))
              : (playingFrame(frames, art.loop && duration > 0 ? elapsed % duration : elapsed) ??
                frames.length - 1);
            const frame = frames[index];
            if (frame === undefined) {
              return;
            }
            const size = art.scale ?? 1;
            const origin = art.origin ?? ORIGIN;
            sheet.place(scale, ORIGIN, {
              frame,
              scale: size,
              x: art.at.x - frame.width * size * origin.x,
              y: art.at.y - frame.height * size * origin.y,
            });
            if (index !== previousFrame) {
              previousFrame = index;
              art.onFrame?.(index);
            }
            const fixedFrame = art.still && art.frameIndex !== undefined;
            if (!fixedFrame && !art.loop && !completed && duration > 0 && elapsed >= duration) {
              completed = true;
              art.onComplete?.();
            }
          },
        );
        return {
          dispose() {
            removed = true;
            unmount();
          },
          ready,
        };
      },
      dispose() {
        if (disposed) {
          return;
        }
        disposed = true;
        reveals.forEach((reveal) => reveal.cancel());
        views.delete(draw);
        roots.delete(api.dispose);
        element.remove();
      },
      element,
      faceRows(at, box, scale, colour, rows) {
        rows.forEach((row, i) => {
          const top = at.capsTop + i * fontMetrics(fonts.body).lineHeight * scale;
          row.texts.forEach((run) =>
            api.text({
              capTop: top,
              colour,
              font: "body",
              lines: [run.text],
              scale,
              x: at.x + run.x,
            }),
          );
          if (box === undefined) {
            return;
          }
          row.faces.forEach((face) => {
            const rect = {
              height: box.framed,
              width: box.framed,
              x: at.x + face.x,
              y: top - box.rise,
            };
            api.panel(rect, undefined, { border: PALETTE.ink, fill: PALETTE.tan });
            api.art({
              at: { x: rect.x + 1, y: rect.y + 1 },
              clock: "now",
              key: ownerCardFaceKey(gameData, face.dog),
              loop: true,
              tags: [face.mood, "neutral"],
            });
          });
        });
      },
      panel(rect, key, colours = { border: PALETTE.plum, fill: PALETTE.cream }, corner = 3) {
        if (key === "ui-panel" || key === "ui-quip") {
          if (hasArt(key)) {
            const panel = imageNineSlice(doc, source, key, { height: 24, width: 24 }, SLICES[key]);
            mount(panel.element, panel.ready, (scale) => panel.place(scale, ORIGIN, rect));
            return;
          }
        } else if (key !== undefined && hasArt(key)) {
          const panel = sheetNineSlice(doc, source, key, {
            bottom: corner,
            left: corner,
            right: corner,
            top: corner,
          });
          mount(panel.element, panel.ready, (scale) =>
            panel.place(scale, ORIGIN, { ...rect, tag: "normal" }),
          );
          return;
        }
        const fallback = doc.createElement("span");
        fallback.className = "adw-art";
        Object.assign(fallback.style, {
          backgroundColor: hex(colours.fill),
          borderColor: hex(colours.border),
          borderStyle: "solid",
          boxSizing: "border-box",
        });
        mount(fallback, Promise.resolve([]), (scale) => {
          placeBox(scale, ORIGIN, fallback, rect);
          fallback.style.borderWidth = `${artPixel(scale)}px`;
        });
      },
      ring(rect, colour, width) {
        const rim = doc.createElement("span");
        rim.className = "adw-art";
        Object.assign(rim.style, {
          borderColor: hex(colour),
          borderStyle: "solid",
          boxSizing: "border-box",
        });
        mount(rim, Promise.resolve([]), (scale) => {
          placeBox(scale, ORIGIN, rim, rect);
          rim.style.borderWidth = `${width * artPixel(scale)}px`;
        });
      },
      state,
      text(text) {
        const part = textBlock(doc, { bitmap: fonts[text.font], pillColours }, text);
        let previous = "";
        mount(part.element, part.ready, (scale) => {
          const key = JSON.stringify(scale);
          if (key !== previous) {
            previous = key;
            part.place(scale);
          }
        });
      },
    };
    roots.add(api.dispose);
    return api;
  };
  return {
    dispose() {
      alive = false;
      offScale();
      offReady();
      [...roots].forEach((dispose) => dispose());
      surface.remove();
    },
    element: surface,
    fonts,
    group,
    hasArt,
    inkWidth: (scale, text) => {
      const inks = laidGlyphs(fonts.body, scale, shownText("body", text)).flatMap(({ ink }) =>
        ink === null ? [] : [ink],
      );
      return inks.length === 0
        ? 0
        : Math.max(...inks.map(({ right }) => right)) - Math.min(...inks.map(({ left }) => left));
    },
    prepare: (assets) => prepareHudArt(source, assets),
    update(next) {
      time = next;
      paint();
    },
    width: (scale, text) => boundsAdvance(fonts.body, shownText("body", text)) * scale,
  };
}
export function prepareHudArt(
  source: DomArtSource,
  assets: readonly {
    key: string;
    kind: "image" | "sheet";
  }[],
): Promise<readonly string[]> {
  return Promise.all(
    assets.map(async ({ key, kind }) => {
      if (kind === "sheet") {
        await source.loadSheet(source.artUrl(domArtPath(kind, key, "json")));
      }
      return source.artUrl(domArtPath(kind, key, "png"));
    }),
  );
}
