import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";

import type { NativeTopSection } from "../../ui/dom/index.ts";
import type { HudCards } from "./hudCards.ts";
import type { HudMoment, HudMomentPainter } from "./hudMoments.ts";
// A picture can expose multiple screen strips while one logical HUD owns its feedback timeline.
export function projectHudMoments(
  painters: readonly HudMomentPainter[],
  stillFrames: Readonly<Record<string, number>> = {},
): HudMomentPainter {
  const first = painters[0];
  if (first === undefined) {
    throw new Error("A HUD projection requires a native surface");
  }
  const groups = new Set<readonly HudMoment[]>();
  return {
    dispose: () => {
      groups.clear();
      painters.forEach((painter) => painter.dispose());
    },
    element: first.element,
    fonts: first.fonts,
    group(depth, clock) {
      const views = painters.map((painter) => painter.group(depth, clock));
      const primary = views[0]!;
      groups.add(views);
      return {
        art(art) {
          const frameIndex = art.tags
            ?.map((tag) => stillFrames[animationKey(art.key, tag)])
            .find((frame) => frame !== undefined);
          const selected = frameIndex === undefined ? art : { ...art, frameIndex, still: true };
          const playback = primary.art(selected);
          const passive = { ...selected };
          delete passive.onComplete;
          delete passive.onFrame;
          const followers = views.slice(1).map((view) => view.art(passive));
          return {
            dispose: () => {
              playback.dispose();
              followers.forEach((follower) => follower.dispose());
            },
            ready: playback.ready,
          };
        },
        dispose: () => {
          groups.delete(views);
          views.forEach((view) => view.dispose());
        },
        element: primary.element,
        panel: (rect, art, colours) => views.forEach((view) => view.panel(rect, art, colours)),
        ring: (rect, colour, width) => views.forEach((view) => view.ring(rect, colour, width)),
        state: primary.state,
        text: (text) => views.forEach((view) => view.text(text)),
      };
    },
    hasArt: (key) => first.hasArt(key),
    inkWidth: (scale, text) => first.inkWidth(scale, text),
    prepare: (assets) => first.prepare(assets),
    update(time) {
      groups.forEach((views) =>
        views.slice(1).forEach((view) => Object.assign(view.state, views[0]!.state)),
      );
      painters.forEach((painter) => painter.update(time));
    },
    width: (scale, text) => first.width(scale, text),
  };
}
export function projectHudCards(
  underlayRoots: readonly Pick<HudMomentPainter, "element">[],
  views: readonly HudCards[],
): HudCards {
  const first = views[0];
  if (first === undefined) {
    throw new Error("HUD cards require a native surface");
  }
  if (underlayRoots.length !== views.length) {
    throw new RangeError("HUD cards require one underlay surface per projection");
  }
  views.forEach((view, index) => underlayRoots[index]!.element.append(view.element));
  return {
    anchor: (slot) => first.anchor(slot),
    dispose: () => views.forEach((view) => view.dispose()),
    element: first.element,
    flashCard: (context, slot) => views.forEach((view) => view.flashCard(context, slot)),
    revealed: Promise.all(views.map((view) => view.revealed)).then((ready) => ready.every(Boolean)),
    setInert: (inert) => views.forEach((view) => view.setInert(inert)),
    setShown: (shown) => views.forEach((view) => view.setShown(shown)),
    update: (context, run) => views.forEach((view) => view.update(context, run)),
  };
}
export function projectHudTopSections(views: readonly NativeTopSection[]): NativeTopSection {
  const first = views[0];
  if (first === undefined) {
    throw new Error("A HUD bar requires a native surface");
  }
  return {
    buttons: first.buttons,
    dispose: () => views.forEach((view) => view.dispose()),
    element: first.element,
    revealed: Promise.all(views.map((view) => view.revealed)).then((ready) => ready.every(Boolean)),
    setAmount: (full, short) => views.forEach((view) => view.setAmount(full, short)),
    setEffectCount: (count) => views.forEach((view) => view.setEffectCount(count)),
    setEffectPressed: (index) => views.forEach((view) => view.setEffectPressed(index)),
    setInert: (inert) => views.forEach((view) => view.setInert(inert)),
    setInputBottom: (bottom) => views.forEach((view) => view.setInputBottom(bottom)),
    setMuted: (muted) => views.forEach((view) => view.setMuted(muted)),
    setPaused: (menu) => views.forEach((view) => view.setPaused(menu)),
    setShown: (shown) => views.forEach((view) => view.setShown(shown)),
    underlayElement: first.underlayElement,
  };
}
