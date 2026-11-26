import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { domArtPath, ownerFaceKey } from "../../assets/index.ts";
import type { DogId } from "../../data/ids.ts";
import { gameData } from "../../data/index.ts";
import { textPart } from "../../home/dom/detailText.ts";
import type { BadgeView } from "../../home/index.ts";
import { sheetArt } from "../../ui/dom/artElements.ts";
import { type DomPart, framelessView } from "../../ui/dom/parts.ts";
import { playingFrame, sheetTagFrames, type TagFrame } from "../../ui/dom/sheetFrames.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import type { DomScale } from "../../ui/index.ts";
import type { DomBadgeCardInput } from "./badgeCard.ts";
import { type BadgeCelebrationView, badgeStripParts } from "./celebration.ts";
import { showQuestionPanel } from "./questionPanel.ts";

type Shared = Omit<DomBadgeCardInput, "view" | "dismiss">;

function cheeringFace(
  layer: UiLayer,
  input: Shared,
  reduced: boolean,
  dog: DogId,
  at: Rect,
): DomPart & { rise(value: number): void; stop(): void } {
  const key = ownerFaceKey(gameData, dog);
  const art = sheetArt(layer.element.ownerDocument, input, key);
  let frames: TagFrame[] = [];
  let scale: DomScale | undefined;
  let rise = 0;
  const startsAt = input.now();
  const show = () => {
    if (scale === undefined || frames.length === 0) {
      return;
    }
    const duration = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    const elapsed = duration === 0 ? 0 : (input.now() - startsAt) % duration;
    const frame = frames[reduced ? 0 : (playingFrame(frames, elapsed) ?? 0)];
    if (frame !== undefined) {
      art.place(scale, { x: 0, y: 0 }, { frame, x: at.x, y: at.y - rise });
    }
  };
  const ready = input.loadSheet(input.artUrl(domArtPath("sheet", key, "json"))).then((json) => {
    frames = sheetTagFrames(json, "happy");
    show();
    return art.ready;
  });
  return {
    element: art.element,
    place: (at) => {
      scale = at;
      show();
    },
    ready,
    rise: (value) => {
      rise = value;
      show();
    },
    stop: input.everyFrame(show),
  };
}

// The ordinary badge award's existing view and animations, rendered entirely in its native modal.
export function showOrdinaryBadgeCelebration(
  layer: UiLayer,
  input: Shared & {
    readonly badges: readonly BadgeView[];
    readonly close: () => void;
    readonly faces: readonly { readonly dog: DogId; readonly rect: Rect }[];
    readonly reduced: boolean;
    readonly rows: number;
    readonly view: BadgeCelebrationView;
  },
) {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const badges = badgeStripParts(doc, input, {
    badges: input.badges,
    closes: true,
    panel: view.panel,
    reduced: input.reduced,
    rows: input.rows,
    ...(view.titleExtraHeight === undefined ? {} : { titleExtraHeight: view.titleExtraHeight }),
  });
  const faces = input.faces.map(({ dog, rect }) =>
    cheeringFace(layer, input, input.reduced, dog, rect),
  );
  const panel = showQuestionPanel(layer, {
    backgroundCancel: input.close,
    close: input.close,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    numberKeys: false,
    parts: [...badges.parts, ...view.names.map((name) => textPart(doc, input, name)), ...faces],
    presses: [input.close],
    toGame: input.toGame,
    view: framelessView(view.panel, {
      buttons: [view.button],
      covered: [view.panel, view.button.hit],
      title: view.title,
    }),
  });
  return {
    badges,
    faces,
    panel: {
      ...panel,
      destroy: () => {
        faces.forEach((face) => face.stop());
        badges.destroy();
        panel.destroy();
      },
    },
  };
}
