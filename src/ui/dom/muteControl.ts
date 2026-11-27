import "./focusStyle.css";
import "./nativeTopSection.css";
import "./muteControl.css";

import { containsPoint } from "@andornaut/game-kit/runtime/rect";
import crashArt from "virtual:adw-crash-art";

import { BUTTON_SIZE, SCREEN_CONFIG } from "../../data/index.ts";
import { MENU_TEXT } from "../../data/menuText.ts";
import { cssHex, PALETTE, TOP_BAR_FACE, topBarGlyphRect, topSectionLayout } from "../index.ts";
import { bindGameActionHolds } from "./actionBinding.ts";
import { createGameButton } from "./gameButton.ts";

// Renderer failure uses the same device preference as Phaser's soundboard.
// The control needs neither a compatible progress save nor loaded game fonts or textures: it
// draws the top bar's Sound from inlined art.
export interface MuteControlSettings {
  readonly current: { readonly muted: boolean };
  setMuted(muted: boolean): void;
  onChange(listener: () => void): () => void;
}

export function mountMuteControl(settings: MuteControlSettings, parent: HTMLElement): () => void {
  const doc = parent.ownerDocument;
  const view = doc.createElement("div");
  view.className = "adw-standalone-mute";
  for (const name of ["cream", "cyan", "darkSlate", "ink"] as const) {
    view.style.setProperty(`--adw-${name}`, cssHex(PALETTE[name]));
  }
  const active = () => !parent.inert && !parent.hidden;
  const toggle = () => {
    if (active()) {
      settings.setMuted(!settings.current.muted);
    }
  };
  // The top bar's face art at rest and pressed, its state fill, and the Sound glyph over them.
  const icon = doc.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  const part = (className: string, image?: string) => {
    const element = doc.createElement("span");
    element.className = `adw-standalone-mute-part ${className}`;
    if (image !== undefined) {
      element.style.backgroundImage = `url("${image}")`;
    }
    icon.append(element);
    return element;
  };
  const faces = [crashArt.face, crashArt.facePressed].map((image) =>
    part("adw-standalone-mute-face", image),
  );
  const fill = part("adw-top-section-fill");
  const glyph = part("adw-standalone-mute-glyph", crashArt.sound);
  const controlView = createGameButton(doc, {
    appearance: { className: "adw-top-section-button", role: "navigation" },
    content: { icon, kind: "icon", name: MENU_TEXT.settings.sound },
    getAction: () => ({ activate: toggle }),
    // Pressed means sound on, as the top bar's Sound control reports it.
    getState: () => ({ toggled: !settings.current.muted }),
    skin: "authored",
  });
  const button = controlView.element;
  button.setAttribute("aria-keyshortcuts", "M");
  view.append(button);
  const [, { face, hit }] = topSectionLayout(["mute", "menu"]).controls[0]!;
  const px = (value: number) => `${value}px`;
  Object.assign(button.style, {
    height: px(hit.height),
    left: px(hit.x),
    top: px(hit.y),
    width: px(hit.width),
  });
  Object.assign(controlView.face.style, {
    height: px(TOP_BAR_FACE.size),
    left: px(face.x - hit.x),
    top: px(face.y - hit.y),
    width: px(TOP_BAR_FACE.size),
  });
  let pressed = false;
  let disposed = false;
  // The face's parts, as the top bar places them: the pressed frame, the fill and the glyph sink
  // with a press.
  const placeFace = () => {
    faces.forEach((element, index) => {
      element.hidden = index !== Number(pressed);
    });
    const dip = pressed ? BUTTON_SIZE.press : 0;
    Object.assign(fill.style, {
      height: px(TOP_BAR_FACE.fill.height),
      left: px(TOP_BAR_FACE.fill.x),
      top: px(TOP_BAR_FACE.fill.y + dip),
      width: px(TOP_BAR_FACE.fill.width),
    });
    const glyphRect = topBarGlyphRect(face, pressed);
    Object.assign(glyph.style, {
      height: px(glyphRect.height),
      left: px(glyphRect.x - face.x),
      top: px(glyphRect.y - face.y),
      width: px(glyphRect.width),
    });
  };
  const setPressed = (value: boolean) => {
    if (pressed !== value && !disposed) {
      pressed = value;
      controlView.setPressed(value);
      placeFace();
    }
  };
  const show = () => {
    if (disposed) {
      return;
    }
    const { muted } = settings.current;
    controlView.refresh();
    const word = muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on;
    button.title = `${MENU_TEXT.settings.sound}: ${word}`;
    button.setAttribute("data-muted", String(muted));
  };
  // The held face, by pointer while the press stays over the button, or by Enter or Space.
  let pointer: number | undefined;
  const inside = (event: PointerEvent) => {
    const rect = button.getBoundingClientRect();
    return containsPoint(
      { height: rect.height, width: rect.width, x: rect.left, y: rect.top },
      event.clientX,
      event.clientY,
    );
  };
  const release = (event: PointerEvent) => {
    if (event.pointerId === pointer) {
      pointer = undefined;
      setPressed(false);
    }
  };
  const listeners: [string, (event: never) => void][] = [
    [
      "pointerdown",
      (event: PointerEvent) => {
        if (event.isPrimary && event.button === 0 && active()) {
          pointer = event.pointerId;
          setPressed(true);
        }
      },
    ],
    [
      "pointermove",
      (event: PointerEvent) => {
        if (event.pointerId === pointer) {
          setPressed(inside(event));
        }
      },
    ],
    ["pointerup", release],
    ["pointercancel", release],
    [
      "keydown",
      (event: KeyboardEvent) => {
        if ((event.code === "Enter" || event.code === "Space") && !event.repeat && active()) {
          setPressed(true);
        }
      },
    ],
    [
      "keyup",
      (event: KeyboardEvent) => {
        if (event.code === "Enter" || event.code === "Space") {
          setPressed(false);
        }
      },
    ],
    [
      "blur",
      () => {
        pointer = undefined;
        setPressed(false);
      },
    ],
  ];
  for (const [name, listener] of listeners) {
    button.addEventListener(name, listener as EventListener);
  }
  const key = (event: KeyboardEvent) => {
    if (active() && event.code === "KeyM" && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    }
  };
  const stopHold = bindGameActionHolds(
    {
      cancelPress: () => undefined,
      guard: { gate: { accepts: active, capture: () => active } },
      unit: () =>
        Math.min(
          parent.clientWidth / SCREEN_CONFIG.width,
          parent.clientHeight / SCREEN_CONFIG.height,
        ),
    },
    view,
  );
  parent.addEventListener("keydown", key);
  doc.defaultView?.addEventListener("keydown", key);
  const stop = settings.onChange(show);
  const place = () => {
    const scale = Math.min(
      parent.clientWidth / SCREEN_CONFIG.width,
      parent.clientHeight / SCREEN_CONFIG.height,
    );
    const x = (parent.clientWidth - SCREEN_CONFIG.width * scale) / 2;
    view.style.transform = `translateX(${x}px) scale(${scale})`;
  };
  const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(place);
  resize?.observe(parent);
  parent.append(view);
  placeFace();
  show();
  place();
  return () => {
    disposed = true;
    stop();
    stopHold();
    for (const [name, listener] of listeners) {
      button.removeEventListener(name, listener as EventListener);
    }
    controlView.dispose();
    resize?.disconnect();
    parent.removeEventListener("keydown", key);
    doc.defaultView?.removeEventListener("keydown", key);
    view.remove();
  };
}
