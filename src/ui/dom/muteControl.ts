import "./focusStyle.css";
import "./muteControl.css";

import crashArt from "virtual:adw-crash-art";

import { MENU_TEXT } from "../../data/menuText.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { cssHex, PALETTE } from "../palette.ts";
import { TITLE_CAP_ROWS } from "../textFit.ts";
import { topSectionLayout, topSectionStateCapTop } from "../topSection.ts";
import { bindGameActionHolds } from "./actionBinding.ts";
import { createControlGlyph } from "./controlGlyph.ts";
import { createGameButton } from "./gameButton.ts";

// Rows from the top of an 8px line box to Silkscreen's capitals at 8px, which the crash screen's
// title face (src/crash/crash.css) sets the state word in, as font-title draws it on the top bar.
export const STATE_WORD_CAP_TOP = 2;

// Renderer failure uses the same device preference as Phaser's soundboard.
// The control needs neither a compatible progress save nor loaded game fonts or textures, and
// uses a vector glyph with inlined raster and text fallbacks rather than a loaded sheet.
export interface MuteControlSettings {
  readonly current: { readonly muted: boolean };
  setMuted(muted: boolean): void;
  onChange(listener: () => void): () => void;
}

export function mountMuteControl(settings: MuteControlSettings, parent: HTMLElement): () => void {
  const doc = parent.ownerDocument;
  const view = doc.createElement("div");
  view.className = "adw-standalone-mute";
  for (const name of [
    "cream",
    "cyan",
    "darkGreen",
    "forest",
    "green",
    "ink",
    "navy",
    "neutralGrey",
    "neutralLightGrey",
    "neutralSlate",
    "plum",
    "tan",
    "white",
    "yellow",
  ] as const) {
    view.style.setProperty(`--adw-${name}`, cssHex(PALETTE[name]));
  }
  const active = () => !parent.inert && !parent.hidden;
  const toggle = () => {
    if (active()) {
      settings.setMuted(!settings.current.muted);
    }
  };
  const icon = doc.createElement("span");
  icon.className = "adw-standalone-mute-icon";
  icon.setAttribute("aria-hidden", "true");
  const controlView = createGameButton(doc, {
    content: { icon, kind: "icon", name: MENU_TEXT.settings.sound },
    getAction: () => ({ activate: toggle }),
    // Pressed means sound on, as the top bar's Sound control reports it.
    getState: () => ({ toggled: !settings.current.muted }),
  });
  const button = controlView.element;
  button.setAttribute("aria-keyshortcuts", "M");
  view.append(button);
  const [, control] = topSectionLayout(["mute", "menu"]).controls[0]!;
  Object.assign(button.style, {
    height: `${control.hit.height}px`,
    left: `${control.hit.x}px`,
    top: `${control.hit.y}px`,
    width: `${control.hit.width}px`,
  });
  button.style.setProperty("--mute-face-x", `${control.face.x - control.hit.x}px`);
  button.style.setProperty("--mute-face-y", `${control.face.y - control.hit.y}px`);
  // The current state, as the top bar shows it: directly below the face, centred across the hit
  // box. The button's pressed state carries it for assistive technology.
  const state = doc.createElement("span");
  state.className = "adw-standalone-mute-state";
  state.setAttribute("aria-hidden", "true");
  Object.assign(state.style, {
    left: `${control.hit.x}px`,
    top: `${topSectionStateCapTop(control.face, TITLE_CAP_ROWS) - STATE_WORD_CAP_TOP}px`,
    width: `${control.hit.width}px`,
  });
  view.append(state);
  const image = doc.createElement("img");
  let rasterReady = false;
  let vector = false;
  image.alt = "";
  image.onload = () => {
    rasterReady = true;
    if (!vector) {
      icon.classList.add("adw-standalone-mute-native");
    }
    icon.style.setProperty("--mute-sprite", `url("${image.src}")`);
  };
  image.src = crashArt.sound;
  const show = () => {
    const { muted } = settings.current;
    controlView.refresh();
    button.title = `${MENU_TEXT.settings.sound}: ${muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on}`;
    button.setAttribute("data-muted", String(muted));
    state.textContent = (muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on).toUpperCase();
    try {
      icon.replaceChildren(createControlGlyph(doc, muted ? "sound-off" : "sound-on"));
      vector = true;
      icon.classList.remove("adw-standalone-mute-native");
    } catch {
      // Keep the inlined bootstrap art and readable text if this DOM cannot construct SVG.
      vector = false;
      icon.replaceChildren();
      icon.textContent = muted ? "X" : MENU_TEXT.settings.on;
      icon.classList.toggle("adw-standalone-mute-native", rasterReady);
    }
  };
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
  show();
  place();
  return () => {
    stop();
    stopHold();
    controlView.dispose();
    resize?.disconnect();
    parent.removeEventListener("keydown", key);
    doc.defaultView?.removeEventListener("keydown", key);
    image.onload = null;
    view.remove();
  };
}
