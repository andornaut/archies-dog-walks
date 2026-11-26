import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { type BitmapFont, fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { BUTTON_SIZE } from "../../data/index.ts";
import { MENU_TEXT } from "../../data/menuText.ts";
import {
  type DomScale,
  gridRect,
  gridX,
  gridY,
  PALETTE,
  TOP_BAR_FACE,
  topBarGlyphRect,
  type TopSectionButton,
  topSectionStateCapTop,
} from "../index.ts";
import { containGameButtonClicks } from "./actionBinding.ts";
import { type DomArtSource, type imageArt, sheetArt } from "./artElements.ts";
import { createGameButton } from "./gameButton.ts";
import { createTextLine, placeBox, placeText, setBox } from "./pixelLine.ts";

export interface NativeTopSectionPress {
  readonly completedAt: number;
  readonly startedAt: number | undefined;
  readonly via: "keyboard" | "pointer";
}

interface BarControl {
  readonly active: () => boolean;
  readonly button: HTMLButtonElement;
  readonly cancel: () => void;
  readonly down: (event: PointerEvent) => void;
  readonly observeClick: (event: MouseEvent) => void;
  readonly clearMetadata: () => void;
  readonly contains: (event: PointerEvent) => boolean;
  readonly setPressed: (pressed: boolean) => void;
}

interface ControlContext {
  readonly image: (key: string) => ReturnType<typeof imageArt>;
  readonly inputBottom: () => number | undefined;
  readonly label: (id: TopSectionButton) => string;
  readonly menu: () => boolean;
  readonly muted: () => boolean;
  readonly origin: Point;
  readonly readScale: () => DomScale;
  readonly root: HTMLElement;
  readonly source: DomArtSource;
  readonly title: BitmapFont;
  readonly trackArt: (ready: Promise<readonly string[]>) => void;
}

export function createTopSectionControl(
  context: ControlContext,
  active: () => boolean,
  press: (metadata: NativeTopSectionPress) => void,
  id: TopSectionButton,
  { face, owned }: { face: Point; owned: Rect },
) {
  const {
    image,
    inputBottom,
    label,
    menu,
    muted,
    origin,
    readScale,
    root,
    source,
    title,
    trackArt,
  } = context;
  const doc = root.ownerDocument;
  const content = doc.createElement("span");
  content.style.display = "contents";
  let pressed = false;
  let startedAt: number | undefined;
  let clickAt: number | undefined;
  let via: NativeTopSectionPress["via"] = "keyboard";
  const view = createGameButton(doc, {
    appearance: { className: "adw-top-section-button", role: "navigation" },
    content: { icon: content, kind: "icon", name: label(id) },
    getAction: () =>
      active()
        ? {
            activate: () => {
              const metadata = {
                completedAt: clickAt ?? doc.defaultView!.performance.now(),
                startedAt: via === "keyboard" ? undefined : startedAt,
                via,
              };
              clickAt = undefined;
              startedAt = undefined;
              press(metadata);
            },
            identity: id === "pause" ? menu() : id,
          }
        : null,
    getState: () => ({ ...(id === "mute" ? { toggled: !muted() } : {}) }),
    skin: "authored",
  });
  const button = view.element;
  const faces = ["normal", "pressed"].map((tag) => {
    const art = image(`ui-icon-button-${tag}`);
    content.append(art.element);
    return art;
  });
  // The face's state fill over its art and under its glyph: ink while pressed; in forced
  // colours ButtonFace, Highlight while focused or pressed.
  const fill = doc.createElement("span");
  fill.className = "adw-framed adw-top-section-fill";
  content.append(fill);
  const glyphRoot = doc.createElement("span");
  glyphRoot.className = "adw-art";
  content.append(glyphRoot);
  const iconKey = () => (id === "pause" && menu() ? "icon-menu" : `icon-${id}`);
  const icons =
    id === "mute"
      ? []
      : (id === "pause" ? ["icon-pause", "icon-menu"] : [iconKey()]).map((key) => ({
          art: image(key),
          key,
        }));
  const sound = id === "mute" ? sheetArt(doc, source, "icon-sound") : undefined;
  const soundState =
    sound === undefined
      ? undefined
      : ({
          capTop: topSectionStateCapTop(face, fontMetrics(title).capHeight),
          centre: "ink",
          centreX: face.x + TOP_BAR_FACE.size / 2,
          colour: PALETTE.cream,
          font: "title",
          scale: 1,
          text: "",
        } as const);
  const soundLabel = soundState === undefined ? undefined : createTextLine(doc, soundState);
  if (soundLabel !== undefined) {
    soundLabel.setAttribute("aria-hidden", "true");
    root.append(soundLabel);
  }
  if (sound !== undefined) {
    trackArt(sound.ready);
  }
  for (const { art } of icons) {
    glyphRoot.append(art.element);
  }
  if (sound !== undefined) {
    glyphRoot.append(sound.element);
  }
  const place = (scale: DomScale) => {
    const bottom = inputBottom();
    placeBox(
      scale,
      origin,
      button,
      bottom === undefined
        ? owned
        : {
            ...owned,
            height: Math.max(0, Math.min(owned.height, bottom - owned.y)),
          },
    );
    placeBox(scale, owned, view.face, {
      ...face,
      height: TOP_BAR_FACE.size,
      width: TOP_BAR_FACE.size,
    });
    for (const [index, art] of faces.entries()) {
      art.element.hidden = index !== Number(pressed);
      art.place(scale, face, {
        ...face,
        height: TOP_BAR_FACE.size,
        projection: "layout",
        width: TOP_BAR_FACE.size,
      });
    }
    // The face inside its tan rim, from its highlight row down to its lip.
    placeBox(scale, face, fill, {
      height: TOP_BAR_FACE.fill.height,
      width: TOP_BAR_FACE.fill.width,
      x: face.x + TOP_BAR_FACE.fill.x,
      y: face.y + TOP_BAR_FACE.fill.y + (pressed ? BUTTON_SIZE.press : 0),
    });
    const glyphRect = topBarGlyphRect(face, pressed);
    const glyphBox = gridRect(scale, glyphRect);
    setBox(glyphRoot, {
      ...glyphBox,
      left: glyphBox.left - gridX(scale, face.x),
      top: glyphBox.top - gridY(scale, face.y),
    });
    for (const { art, key } of icons) {
      art.element.hidden = key !== iconKey();
      art.place(scale, glyphRect, { ...glyphRect, projection: "layout" });
    }
    sound?.place(scale, glyphRect, {
      projection: "layout",
      tag: muted() ? "off" : "on",
      x: glyphRect.x,
      y: glyphRect.y,
    });
    if (soundLabel !== undefined && soundState !== undefined) {
      const text = muted() ? MENU_TEXT.settings.off : MENU_TEXT.settings.on;
      soundLabel.textContent = text.toUpperCase();
      placeText(title, scale, origin, soundLabel, { ...soundState, text });
    }
  };
  const setPressed = (value: boolean) => {
    pressed = value;
    view.setPressed(value);
    place(readScale());
  };
  const record: BarControl = {
    active,
    button,
    cancel: () => setPressed(false),
    clearMetadata: () => {
      startedAt = undefined;
      clickAt = undefined;
      via = "keyboard";
    },
    contains: (event) => {
      const rect = button.getBoundingClientRect();
      return containsPoint(
        { height: rect.height, width: rect.width, x: rect.left, y: rect.top },
        event.clientX,
        event.clientY,
      );
    },
    down: (event) => {
      startedAt = event.timeStamp;
      clickAt = undefined;
      via = "pointer";
      const target = event.target as Element | null;
      if (target?.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      if (button.hasPointerCapture(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }
      setPressed(true);
    },
    observeClick: (event) => {
      via = event.detail === 0 ? "keyboard" : "pointer";
      clickAt = event.timeStamp;
      if (via === "keyboard") {
        startedAt = undefined;
      }
    },
    setPressed,
  };
  button.addEventListener("blur", () => setPressed(false));
  containGameButtonClicks(button);
  for (const name of ["mousedown", "touchstart"]) {
    button.addEventListener(name, (event) => event.stopPropagation());
  }
  button.addEventListener("keydown", (event) => {
    if (event.code === "Enter" || event.code === "Space") {
      event.stopPropagation();
      if (event.repeat) {
        event.preventDefault();
      } else if (active()) {
        setPressed(true);
      }
    }
  });
  button.addEventListener("keyup", (event) => {
    if (event.code === "Enter" || event.code === "Space") {
      setPressed(false);
    }
  });
  const updateIcon = () => {
    view.setContent({
      icon: content,
      kind: "icon",
      name: label(id === "pause" && menu() ? "menu" : id),
    });
    view.refresh();
    if (id === "mute") {
      button.setAttribute("aria-pressed", String(!muted()));
    }
    place(readScale());
  };
  root.append(button);
  return { dispose: view.dispose, place, record, updateIcon };
}
