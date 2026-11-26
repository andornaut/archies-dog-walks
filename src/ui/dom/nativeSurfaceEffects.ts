import type { Point } from "@andornaut/game-kit/runtime/rect";

import { SCREEN_CONFIG } from "../../data/index.ts";
import { isConfirmKey } from "../../input/index.ts";
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
  input: { readonly accepts: () => boolean; readonly focusables: () => readonly HTMLElement[] },
  dialog: HTMLElement,
): void {
  const doc = dialog.ownerDocument;
  const { accepts, focusables } = input;
  dialog.addEventListener("keydown", (event) => {
    if (!accepts()) {
      return;
    }
    // Enter and Space press the focused control natively; the scene under never hears them.
    if (
      isConfirmKey(event.code) &&
      focusables().some(
        (control) =>
          control.tagName.toLowerCase() === "button" && control.contains(event.target as Node),
      )
    ) {
      if (event.repeat) {
        event.preventDefault();
      }
      event.stopPropagation();
      return;
    }
    if (event.code !== "Tab") {
      return;
    }
    const visible = focusables().filter(
      (control) =>
        (control.tagName.toLowerCase() !== "button" || control.tabIndex >= 0) &&
        !control.hidden &&
        control.closest?.("[hidden]") == null,
    );
    const at = visible.indexOf(doc.activeElement as HTMLElement);
    const step = event.shiftKey ? visible.length - 1 : 1;
    // From the dialog itself, Tab enters at the first button and Shift+Tab at the close control.
    const next =
      at === -1 ? (event.shiftKey ? visible.length - 1 : 0) : (at + step) % visible.length;
    event.preventDefault();
    (visible[next] ?? dialog).focus();
  });
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
