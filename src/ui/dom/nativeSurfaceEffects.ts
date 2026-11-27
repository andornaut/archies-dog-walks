import type { Point } from "@andornaut/game-kit/runtime/rect";

import { SCREEN_CONFIG } from "../../data/index.ts";
import {
  focusDirectionForKey,
  isConfirmKey,
  nativeButtonKeyAllowed,
  sceneKeyAllowed,
} from "../../input/index.ts";
import { artPixel, deviceX, deviceY, type DomScale, gridTransform } from "../index.ts";
import { setBox } from "./pixelLine.ts";
import type { UiLayer } from "./uiLayer.ts";

// art: fx-tap's side.
const BURST_SIDE = 16;

// fx-tap's burst over every panel (burstHost), centred on a game point where a press landed.
export function addTapBurst(layer: UiLayer, at: Point): void {
  const element = layer.element.ownerDocument.createElement("span");
  element.className = "adw-burst";
  const scale = layer.scale();
  const side = BURST_SIDE * artPixel(scale);
  setBox(element, {
    height: side,
    left: deviceX(scale, at.x) - side / 2,
    top: deviceY(scale, at.y) - side / 2,
    width: side,
  });
  element.style.setProperty("--adw-burst", `${side}px`);
  element.addEventListener("animationend", () => element.remove());
  burstHost(layer, scale).append(element);
}

// Each layer's root for tap bursts: over every panel, laid out in device pixels as a panel is,
// so a burst plays on while a panel under it is drawn again, as the canvas's burst scene does.
const burstHosts = new WeakMap<HTMLElement, HTMLElement>();

function burstHost(layer: UiLayer, scale: DomScale): HTMLElement {
  let host = burstHosts.get(layer.element);
  if (host === undefined) {
    host = layer.element.ownerDocument.createElement("div");
    host.className = "adw-dialog adw-passive adw-bursts";
    host.setAttribute("aria-hidden", "true");
    burstHosts.set(layer.element, host);
  }
  host.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
  host.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
  host.style.transform = gridTransform(scale);
  // Last, so over every panel.
  layer.element.append(host);
  return host;
}

// Enter and Space press the focused button natively, and the scene under never hears them; Tab and
// Shift+Tab move the focus among the visible focusables in order, round from the last to the
// first, and from the dialog itself enter at the first or the last.
export function bindDialogKeys(
  input: {
    readonly accepts: () => boolean;
    readonly directionKeys?: false;
    readonly dismissControl?: () => HTMLElement | undefined;
    readonly focusables: () => readonly HTMLElement[];
    readonly ownsKeyboard?: () => boolean;
  },
  dialog: HTMLElement,
): () => void {
  const doc = dialog.ownerDocument;
  const { accepts, focusables } = input;
  const visible = () =>
    focusables().filter(
      (control) =>
        !control.hidden &&
        control.closest?.("[hidden]") == null &&
        (control.tagName.toLowerCase() !== "button" || control.tabIndex >= 0),
    );
  // The existing input scope owns Escape even before its first paint, but cannot act yet.
  const escape = (event: KeyboardEvent) => {
    if (
      event.code !== "Escape" ||
      !sceneKeyAllowed(event) ||
      !(input.ownsKeyboard?.() ?? accepts())
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!accepts() || event.repeat) {
      return;
    }
    const control = input.dismissControl?.();
    if (
      control?.isConnected &&
      !control.hidden &&
      control.closest?.("[hidden]") == null &&
      control.tabIndex >= 0 &&
      !(control as HTMLButtonElement).disabled &&
      control.getAttribute("aria-disabled") !== "true"
    ) {
      control.click();
    }
  };
  doc.addEventListener("keydown", escape, true);
  // Directional focus is admitted before a slider can take its vertical arrows.
  dialog.addEventListener(
    "keydown",
    (event) => {
      if (!accepts() || !sceneKeyAllowed(event)) {
        return;
      }
      const direction = focusDirectionForKey(event.code);
      if (direction === undefined || input.directionKeys === false) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.getAttribute?.("role") === "slider" &&
        (direction === "left" || direction === "right")
      ) {
        return;
      }
      const controls = visible().filter((control) => control.getAttribute("role") !== "region");
      if (controls.length === 0) {
        return;
      }
      const at = controls.indexOf(doc.activeElement as HTMLElement);
      const backwards = direction === "up" || direction === "left";
      const next =
        at === -1
          ? backwards
            ? controls.length - 1
            : 0
          : (at + (backwards ? controls.length - 1 : 1)) % controls.length;
      event.preventDefault();
      event.stopImmediatePropagation();
      controls[next]!.focus();
    },
    { capture: true },
  );
  // Preserve the complete native confirmation. In particular, Space clicks on keyup.
  const nativeConfirm = (event: KeyboardEvent) => {
    if (
      accepts() &&
      isConfirmKey(event.code) &&
      nativeButtonKeyAllowed(event) &&
      focusables().some(
        (control) =>
          control.tagName.toLowerCase() === "button" && control.contains(event.target as Node),
      )
    ) {
      if (event.type === "keydown" && event.repeat) {
        event.preventDefault();
      }
      event.stopPropagation();
    }
  };
  for (const type of ["keydown", "keypress", "keyup"] as const) {
    dialog.addEventListener(type, nativeConfirm);
  }
  dialog.addEventListener("keydown", (event) => {
    if (!accepts() || event.code !== "Tab" || !sceneKeyAllowed(event)) {
      return;
    }
    const controls = visible();
    const at = controls.indexOf(doc.activeElement as HTMLElement);
    const step = event.shiftKey ? controls.length - 1 : 1;
    // From the dialog itself, Tab enters at the first button and Shift+Tab at the close control.
    const next =
      at === -1 ? (event.shiftKey ? controls.length - 1 : 0) : (at + step) % controls.length;
    event.preventDefault();
    (controls[next] ?? dialog).focus();
  });
  return () => doc.removeEventListener("keydown", escape, true);
}

// The art URLs every element in root draws as a background image, so its reveal waits for them.
export function artUrls(root: HTMLElement): Set<string> {
  const view = root.ownerDocument.defaultView;
  const urls = new Set<string>();
  const visit = (element: HTMLElement) => {
    const background =
      view?.getComputedStyle?.(element).backgroundImage ?? element.style.backgroundImage ?? "";
    for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      urls.add(match[1]!);
    }
    for (const child of element.children) {
      visit(child as HTMLElement);
    }
  };
  visit(root);
  return urls;
}
