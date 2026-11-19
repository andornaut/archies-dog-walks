import "./muteControl.css";

import crashArt from "virtual:adw-crash-art";

import { MENU_TEXT } from "../../data/menuText.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { PALETTE } from "../palette.ts";
import { topSectionLayout } from "../topSection.ts";
import { bindGameAction, bindGameActionHolds } from "./actionBinding.ts";

// Renderer failure uses the same device preference as Phaser's soundboard.
// The control needs neither a compatible progress save nor loaded game fonts or textures, and
// draws its art inlined (virtual:adw-crash-art) rather than from a sheet.
export interface MuteControlSettings {
  readonly current: { readonly muted: boolean };
  setMuted(muted: boolean): void;
  onChange(listener: () => void): () => void;
}

export function mountMuteControl(settings: MuteControlSettings, parent: HTMLElement): () => void {
  const doc = parent.ownerDocument;
  const view = doc.createElement("div");
  view.className = "adw-standalone-mute";
  for (const name of ["amber", "brown", "cream", "ink"] as const) {
    view.style.setProperty(`--mute-${name}`, `#${PALETTE[name].toString(16).padStart(6, "0")}`);
  }
  const button = doc.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", MENU_TEXT.settings.sound);
  button.setAttribute("aria-keyshortcuts", "M");
  const icon = doc.createElement("span");
  icon.className = "adw-standalone-mute-icon";
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);
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
  button.style.setProperty("--mute-chrome", `url("${crashArt.chrome}")`);
  const image = doc.createElement("img");
  image.alt = "";
  image.onload = () => {
    icon.classList.add("adw-standalone-mute-native");
    icon.style.setProperty("--mute-sprite", `url("${image.src}")`);
  };
  image.src = crashArt.sound;
  const show = () => {
    const { muted } = settings.current;
    button.setAttribute("aria-pressed", String(muted));
    button.title = `${MENU_TEXT.settings.sound}: ${muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on}`;
    button.setAttribute("data-muted", String(muted));
    icon.textContent = muted ? "X" : MENU_TEXT.settings.on;
  };
  const active = () => !parent.inert && !parent.hidden;
  const toggle = () => {
    if (active()) {
      settings.setMuted(!settings.current.muted);
    }
  };
  const key = (event: KeyboardEvent) => {
    if (active() && event.code === "KeyM" && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    }
  };
  const unbind = bindGameAction({ activate: () => toggle(), available: active }, button);
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
    unbind();
    resize?.disconnect();
    parent.removeEventListener("keydown", key);
    doc.defaultView?.removeEventListener("keydown", key);
    image.onload = null;
    view.remove();
  };
}
