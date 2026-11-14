import "./muteControl.css";

import { artUrl } from "../../assets/artFiles.ts";
import { MENU_TEXT } from "../../data/menuText.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { PALETTE } from "../palette.ts";
import { topSectionLayout } from "../topSection.ts";

// Boot and renderer-failure screens share the same device preference as Phaser's soundboard.
// The control needs neither a compatible progress save nor loaded game fonts or textures.
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
  button.style.setProperty("--mute-chrome", `url("${artUrl("images/ui-icon-button-normal.png")}")`);
  const image = doc.createElement("img");
  image.alt = "";
  image.onload = () => {
    icon.classList.add("adw-standalone-mute-native");
    icon.style.setProperty("--mute-sprite", `url("${image.src}")`);
  };
  image.src = artUrl("sprites/icon-sound.png");
  const show = () => {
    const { muted } = settings.current;
    button.setAttribute("aria-pressed", String(muted));
    button.title = `${MENU_TEXT.settings.sound}: ${muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on}`;
    button.setAttribute("data-muted", String(muted));
    icon.textContent = muted ? "X" : MENU_TEXT.settings.on;
  };
  const toggle = () => settings.setMuted(!settings.current.muted);
  const key = (event: KeyboardEvent) => {
    if (event.code === "KeyM" && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    }
  };
  button.addEventListener("click", toggle);
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
    resize?.disconnect();
    parent.removeEventListener("keydown", key);
    doc.defaultView?.removeEventListener("keydown", key);
    image.onload = null;
    view.remove();
  };
}
