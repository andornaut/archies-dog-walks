import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { dogCardTag, dogFaceKey, domArtPath, ownerFaceKey } from "../../assets/index.ts";
import { type GameData, SCREEN_CONFIG } from "../../data/index.ts";
import { loopFrame } from "../../home/index.ts";
import { SCREEN_LAYOUT } from "../../layout/index.ts";
import { faceMood, ownerMaxHearts } from "../../rules/index.ts";
import type { RunState } from "../../state/index.ts";
import {
  createTextLine,
  type DomArtSource,
  type DomTextLine,
  gridFillPart,
  imageArt,
  placeBackedText,
  placeText,
  playingFrame,
  setBox,
  sheetArt,
  sheetTagFrames,
  type TagFrame,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  deviceX,
  deviceY,
  type DomScale,
  gridTransform,
  PALETTE,
  TEXT_SCALE,
} from "../../ui/index.ts";
import {
  cardHearts,
  cardOwnerMood,
  DOG_CARD,
  dogCardEmptyFace,
  FEEDBACK,
  hudOwnerName,
  leadSlot,
  slotShown,
} from "../index.ts";

export interface HudCardsContext {
  readonly momentNow: number;
  readonly now: number;
  readonly ownedSlots: number;
  readonly reducedMotion: boolean;
}

export interface HudCards {
  readonly element: HTMLElement;
  readonly revealed: Promise<boolean>;
  anchor(slot: number): Point | undefined;
  dispose(): void;
  flashCard(context: { readonly now: number; readonly reducedMotion: boolean }, slot: number): void;
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
  update(context: HudCardsContext, run: RunState): void;
}

type Fonts = Readonly<Record<"body" | "title", BitmapFont>>;
type CardText = Omit<DomTextLine, "font"> & { readonly font: keyof Fonts };
type Draw = (scale: DomScale, context: HudCardsContext) => void;
interface Flash {
  readonly start: number;
  readonly still: boolean;
}
interface CardView {
  readonly draw: Draw;
  readonly element: HTMLElement;
  readonly ready: Promise<boolean>;
  readonly reveal: { cancel(): void };
}
interface Slot {
  readonly host: HTMLElement;
  current?: CardView;
  flashes: Flash[];
  generation: number;
  key: string;
  pending?: CardView | undefined;
}
const ORIGIN = { x: 0, y: 0 } as const;
const LOSS_TAG = "heart-loss";
// ui-lead-tag's native dimensions, placed at the card layout's lead anchor.
const LEAD_ART = { height: 11, width: 27 } as const;
// Art uses the scene clock; feedback uses the caller's held moment clock.
export function createHudCards(
  layer: UiLayer,
  source: DomArtSource,
  fonts: Fonts,
  data: Pick<GameData, "dogs" | "runText" | "tuning">,
): HudCards {
  const doc = layer.element.ownerDocument;
  const root = doc.createElement("div");
  root.className = "adw-dialog";
  layer.element.append(root);
  const slots: Slot[] = SCREEN_LAYOUT.dogSlots.map(() => {
    const host = doc.createElement("div");
    host.className = "adw-lines";
    root.append(host);
    return { flashes: [], generation: 0, host, key: "" };
  });
  let alive = true;
  let context: HudCardsContext = { momentNow: 0, now: 0, ownedSlots: 0, reducedMotion: false };
  let initial = false;
  let resolveInitial: (ready: boolean) => void = () => undefined;
  const revealed = new Promise<boolean>((resolve) => {
    resolveInitial = resolve;
  });
  const cleanups: (() => void)[] = [];
  const fontsReady = layer.ready()
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const off = layer.onReady(() => {
          if (layer.ready()) {
            off();
            resolve();
          }
        });
        cleanups.push(off);
      });
  let lossFrames: readonly TagFrame[] = [];
  let lossSettled = false;
  const lossReady = source
    .loadSheet(source.artUrl(domArtPath("sheet", "ui-dog-card", "json")))
    .then(
      (json) => {
        lossFrames = sheetTagFrames(json, LOSS_TAG);
      },
      () => undefined,
    )
    .finally(() => {
      lossSettled = true;
    });
  const checkInitial = () => {
    if (
      !initial &&
      alive &&
      slots.every(
        ({ current, key, pending }) => key !== "" && current !== undefined && pending === undefined,
      )
    ) {
      initial = true;
      resolveInitial(true);
    }
  };
  const frame = (parent: HTMLElement, placed: Draw[], colour: number, rect: Rect) => {
    const part = gridFillPart(doc, ORIGIN, { colour, rect }, "span");
    parent.append(part.element);
    placed.push((scale) => part.place(scale));
  };
  const build = (index: number, lead: number | undefined, run: RunState): CardView => {
    const rect = SCREEN_LAYOUT.dogSlots[index]!;
    const holder = doc.createElement("div");
    holder.className = "adw-lines";
    holder.setAttribute("data-hud-slot", String(index));
    const slot = slots[index]!;
    const draws: Draw[] = [];
    const ready: Promise<readonly string[]>[] = [];
    const part = run.pack[index];
    const shown = slotShown(context.ownedSlots, index, part !== undefined);
    // A line placed as laid out, or its ink centred on the backing it sits on.
    const text = (line: CardText, spoken = true, backing?: Rect) => {
      const element = createTextLine(doc, line);
      if (!spoken) {
        element.setAttribute("aria-hidden", "true");
      }
      holder.append(element);
      draws.push((scale) =>
        backing === undefined
          ? placeText(fonts[line.font], scale, ORIGIN, element, line)
          : placeBackedText(fonts[line.font], scale, ORIGIN, backing, [{ element, line }]),
      );
    };
    const sprite = (key: string, tag: string, at: Point) => {
      const art = sheetArt(doc, source, key);
      const started = context.now;
      let frames: readonly TagFrame[] = [];
      holder.append(art.element);
      ready.push(art.ready);
      source.loadSheet(source.artUrl(domArtPath("sheet", key, "json"))).then(
        (json) => {
          frames = sheetTagFrames(json, tag);
        },
        () => undefined,
      );
      draws.push((scale, clock) => {
        const selected =
          frames[
            loopFrame(
              clock.reducedMotion,
              frames.map(({ durationMs }) => durationMs),
              Math.max(0, clock.now - started),
            )
          ];
        art.place(scale, ORIGIN, {
          ...at,
          projection: "layout",
          ...(selected === undefined ? { tag } : { frame: selected }),
        });
      });
      return art;
    };
    const flashHost = doc.createElement("div");
    flashHost.className = "adw-lines";
    const flashParts = new Map<Flash, ReturnType<typeof sheetArt>>();
    if (shown === "hidden") {
      holder.hidden = true;
    } else if (shown === "empty" || part === undefined) {
      const edge = { ...rect, width: rect.width - 2, x: rect.x + 1 };
      for (let x = 0; x < edge.width; x += 4) {
        for (const y of [edge.y, edge.y + edge.height - 1]) {
          frame(holder, draws, PALETTE.tan, {
            height: 1,
            width: Math.min(2, edge.width - x),
            x: edge.x + x,
            y,
          });
        }
      }
      for (let y = 0; y < edge.height; y += 4) {
        for (const x of [edge.x, edge.x + edge.width - 1]) {
          frame(holder, draws, PALETTE.tan, {
            height: Math.min(2, edge.height - y),
            width: 1,
            x,
            y: edge.y + y,
          });
        }
      }
      text(
        {
          capTop: rect.y,
          centre: "ink",
          centreX: rect.x,
          colour: PALETTE.cream,
          font: "title",
          scale: TEXT_SCALE,
          text: data.runText.empty,
        },
        true,
        dogCardEmptyFace(rect),
      );
    } else {
      const dog = data.dogs[part.dog];
      const fired = part.status === "fired";
      const max = ownerMaxHearts(data, run, part.dog);
      sprite("ui-dog-card", dogCardTag(data, fired ? null : part.dog), rect);
      holder.append(flashHost);
      if (index === lead) {
        const spoken = doc.createElement("span");
        spoken.className = "visually-hidden";
        spoken.textContent = data.runText.lead;
        holder.append(spoken);
        const art = imageArt(doc, source, "ui-lead-tag");
        ready.push(art.ready);
        holder.append(art.element);
        draws.push((scale) =>
          art.place(scale, ORIGIN, {
            ...LEAD_ART,
            projection: "layout",
            x: rect.x + DOG_CARD.lead.x,
            y: rect.y + DOG_CARD.lead.y,
          }),
        );
      }
      if (!fired) {
        sprite(dogFaceKey(data, part.dog), faceMood(data, max, part.hearts), {
          x: rect.x + DOG_CARD.dogFace.x,
          y: rect.y + DOG_CARD.dogFace.y,
        });
      }
      sprite(ownerFaceKey(data, part.dog), cardOwnerMood(data, max, part), {
        x: rect.x + DOG_CARD.owner.face.x,
        y: rect.y + DOG_CARD.owner.face.y,
      });
      text({
        capTop: rect.y + DOG_CARD.name.top,
        centre: "ink",
        centreX: rect.x + DOG_CARD.name.x,
        colour: PALETTE.cream,
        font: "title",
        scale: DOG_CARD.name.scale,
        text: dog.name,
      });
      const owner = hudOwnerName(fonts.body, dog.owner.name);
      text(
        {
          capTop: rect.y + owner.top,
          centre: "left",
          centreX: rect.x + owner.x - owner.ink.left,
          colour: PALETTE.tan,
          font: "body",
          projection: "layout",
          scale: DOG_CARD.owner.name.scale,
          text: owner.text,
        },
        false,
      );
      const ownerName = doc.createElement("span");
      ownerName.className = "visually-hidden";
      ownerName.textContent = dog.owner.name;
      holder.append(ownerName);
      if (fired) {
        const plate = DOG_CARD.firedPlate;
        text(
          {
            capTop: rect.y,
            centre: "ink",
            centreX: rect.x,
            colour: PALETTE.white,
            font: "title",
            scale: 1,
            text: data.runText.fired,
          },
          true,
          { ...plate, x: rect.x + plate.x, y: rect.y + plate.y },
        );
      }
      for (const cell of cardHearts(fired ? 0 : part.hearts, max)) {
        sprite("ui-heart", cell.full ? "full-dark" : "empty-dark", {
          x: rect.x + cell.x,
          y: rect.y + cell.y,
        });
      }
    }
    slot.host.append(holder);
    const reveal = layer.reveal(
      Promise.all([fontsReady, lossReady, Promise.all(ready)]).then(([, , arrays]) =>
        arrays.flat(),
      ),
      holder,
    );
    return {
      draw(scale, clock) {
        draws.forEach((draw) => draw(scale, clock));
        const duration = lossFrames.reduce((sum, { durationMs }) => sum + durationMs, 0);
        if (lossSettled) {
          slot.flashes = slot.flashes.filter(({ start }) => clock.momentNow - start < duration);
        }
        for (const [flash, art] of flashParts) {
          if (!slot.flashes.includes(flash)) {
            art.element.remove();
            flashParts.delete(flash);
          }
        }
        let dx = 0;
        for (const flash of slot.flashes) {
          const selected = playingFrame(lossFrames, Math.max(0, clock.momentNow - flash.start));
          if (selected === undefined) {
            continue;
          }
          let art = flashParts.get(flash);
          if (art === undefined) {
            art = sheetArt(doc, source, "ui-dog-card");
            flashHost.append(art.element);
            flashParts.set(flash, art);
          }
          const current = lossFrames[selected];
          if (current !== undefined) {
            art.place(scale, ORIGIN, {
              frame: current,
              projection: "layout",
              x: rect.x,
              y: rect.y,
            });
          }
          if (!flash.still) {
            dx = FEEDBACK.heart.shakeDx[selected] ?? 0;
          }
        }
        holder.style.transform = `translateX(${dx * artPixel(scale)}px)`;
      },
      element: holder,
      ready: reveal.revealed,
      reveal,
    };
  };
  const place = () => {
    const scale = layer.scale();
    setBox(root, {
      height: deviceY(scale, SCREEN_CONFIG.height),
      left: 0,
      top: 0,
      width: deviceX(scale, SCREEN_CONFIG.width),
    });
    root.style.transform = gridTransform(scale);
    for (const slot of slots) {
      slot.current?.draw(scale, context);
      slot.pending?.draw(scale, context);
    }
  };
  const offScale = layer.onScale(place);
  place();
  return {
    anchor(index) {
      const rect = SCREEN_LAYOUT.dogSlots[index];
      return rect === undefined ? undefined : { x: rect.x, y: rect.y };
    },
    dispose() {
      if (!alive) {
        return;
      }
      alive = false;
      offScale();
      cleanups.forEach((cleanup) => cleanup());
      for (const slot of slots) {
        slot.generation += 1;
        slot.current?.reveal.cancel();
        slot.pending?.reveal.cancel();
      }
      root.remove();
      resolveInitial(false);
    },
    element: root,
    flashCard({ now, reducedMotion }, index) {
      const slot = slots[index];
      if (slot === undefined || !alive) {
        return;
      }
      slot.flashes.push({ start: now, still: reducedMotion });
      place();
    },
    revealed,
    setInert(inert) {
      root.inert = inert;
    },
    setShown(shown) {
      root.hidden = !shown;
    },
    update(next, run) {
      if (!alive) {
        return;
      }
      context = next;
      const lead = leadSlot(run.pack.map(({ status }) => status === "walking"));
      slots.forEach((slot, index) => {
        const part = run.pack[index];
        const key = JSON.stringify([
          slotShown(context.ownedSlots, index, part !== undefined),
          part,
          index === lead,
          part === undefined ? null : [ownerMaxHearts(data, run, part.dog), data.dogs[part.dog]],
        ]);
        if (slot.key === key) {
          return;
        }
        slot.key = key;
        const generation = ++slot.generation;
        slot.pending?.reveal.cancel();
        slot.pending?.element.remove();
        const pending = build(index, lead, run);
        slot.pending = pending;
        pending.draw(layer.scale(), context);
        void pending.ready.then((shown) => {
          if (!shown || !alive || generation !== slot.generation) {
            return;
          }
          slot.current?.reveal.cancel();
          slot.current?.element.remove();
          slot.current = pending;
          slot.pending = undefined;
          pending.draw(layer.scale(), context);
          checkInitial();
        });
      });
      place();
      checkInitial();
    },
  };
}
