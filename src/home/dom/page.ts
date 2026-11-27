import "@andornaut/game-kit/runtime/web/ui/dom/actionGroup.css";
import "@andornaut/game-kit/runtime/web/ui/dom/modalFrame.css";

import type { Point } from "@andornaut/game-kit/runtime/rect";
import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { createModalFrame } from "@andornaut/game-kit/runtime/web/ui/dom/modalFrame";

import { SCREEN_CONFIG } from "../../data/index.ts";
import {
  addTapBurst,
  artUrls,
  bindDialogKeys,
  type BodyScroll,
  bodyScrollbarPart,
  colourBox,
  createPanelButton,
  createTextLine,
  dimDrawn,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  followModalUnderlay,
  mountModalLifecycle,
  type NativeGesture,
  placeFrame,
  placeText,
  refuse,
  setBox,
  setRampDimmed,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  deviceX,
  deviceY,
  type DomScale,
  gridTransform,
  gridX,
  gridY,
  PAGE_FRAME,
  PAGE_LAYOUT,
  type PanelButton,
  type PanelText,
} from "../../ui/index.ts";
import { type PageFill, type PageTab, shopTabRects } from "../index.ts";
import { createPageTab } from "./shopPage.ts";

// The page template the Pet shop, the Logbook and Help share in HTML over the canvas: the kit's
// page frame (createModalFrame's page variant, PAGE_FRAME) under the live top bar, with no close
// control, placed on the art-pixel grid (gridX, gridY). The frame is the dialog and owns its name,
// title box and footer, whose kit action group places Back (pageBack) on the grid; the page draws
// in it. In painting order: its fill in the frame's skin, its title's lines in the title box, then
// in the body its tabs across the tab span (shopTabRects), the page's own parts, its list or body
// clipped to its view, the pages' scrollbar beside it and the page's overlays, all placed from the
// screen's corner, and Back's face and label. The page moves and clips its own list (scroll
// "game"). A page is not a modal: it opens off the modal layer, the top bar over it keeps its
// buttons, and a modal over it (the Menu, a detail card) dims and stills it with the rest of the
// background.

export interface PageChrome {
  readonly back: PanelButton;
  // The page's own fill; none where the canvas draws the page.
  readonly fill?: PageFill;
  readonly tabs?: readonly PageTab[];
  readonly title?: readonly PanelText[];
}

export interface DomPageInput extends Pick<
  DomQuestionPanelInput,
  "describedBy" | "fonts" | "gesture" | "label" | "onFocus" | "toGame"
> {
  // Whether the page's scene takes input, beside the page's own admission.
  readonly active?: () => boolean;
  // What Back does.
  readonly back: () => void;
  readonly chrome: PageChrome;
  // The list or body: its part, the clip its content scrolls in, and its scroll.
  readonly list: {
    readonly clip: HTMLElement;
    readonly part: DomPart;
    readonly scroll: () => PageScroll;
  };
  // Drawn over the list and its scrollbar.
  readonly overlays?: readonly DomPart[];
  // Drawn between the tabs and the list.
  readonly parts?: readonly DomPart[];
  // What a press on the tab at index does.
  readonly tab?: (index: number) => void;
}

// The list's view and its content's height from the view's top, and where the scene moves the
// content, how far it is scrolled.
export type PageScroll = Omit<BodyScroll, "scrollbar">;

export interface DomPage extends DomQuestionPanel {
  // Redraws the scrollbar for a scroll the clip does not report.
  follow(): void;
  setFill(fill: PageFill): void;
  // The index of the tab that holds target, if any.
  tabAt(target: Node): number | undefined;
}

const SCREEN_CORNER = { x: 0, y: 0 } as const;

// Back's index among the page's actions.
const BACK = -1;

// Ids that tie each page's dialog to its title.
let pages = 0;

// A box over the screen with its corner on the screen's, inside a frame part placed at corner.
function screenHost(doc: Document): {
  readonly element: HTMLElement;
  place(scale: DomScale, corner: Point): void;
} {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  return {
    element,
    place: (scale, corner) =>
      setBox(element, {
        height: deviceY(scale, SCREEN_CONFIG.height),
        left: -gridX(scale, corner.x),
        top: -gridY(scale, corner.y),
        width: deviceX(scale, SCREEN_CONFIG.width),
      }),
  };
}

// The page in layer, shown and its dialog focused.
export function showPage(layer: UiLayer, input: DomPageInput): DomPage {
  const doc = layer.element.ownerDocument;
  const { chrome } = input;
  const title = chrome.title ?? [];
  const name = input.label ?? title.map((line) => line.text).join(" ");
  pages += 1;
  const frame = createModalFrame(doc, {
    cardClassName: "adw-page adw-picker-surface",
    id: `adw-page-${pages}`,
    ...(title.length === 0 ? { label: name } : { title: name }),
  });
  const root = frame.element;
  const dialog = frame.card;
  root.classList.add("adw-dialog");
  // Focus starts on the dialog itself, so no control shows the keyboard's ring until Tab.
  dialog.tabIndex = -1;
  if (input.describedBy !== undefined) {
    dialog.setAttribute("aria-describedby", input.describedBy);
  }
  // The page's own admission, which Back, its keys and its focus follow; the tabs and the page's
  // caller also need its scene to take input.
  const admits = () => lifecycle.accepts();
  const accepts = () => (input.active?.() ?? true) && admits();
  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));

  // The fill, in the skin under every other part.
  const fillHost = screenHost(doc);
  frame.skin.append(fillHost.element);
  let fill: { readonly element: HTMLElement; readonly rect: PageFill["rect"] } | undefined;
  const setFillElement = (next: PageFill | undefined) => {
    fill =
      next === undefined ? undefined : { element: colourBox(doc, next.colour), rect: next.rect };
    fillHost.element.replaceChildren(...(fill === undefined ? [] : [fill.element]));
  };
  setFillElement(chrome.fill);

  // The title's lines in capitals, placed from the title box; a screen reader reads its words as
  // written.
  const titleLines = title.map((line) => {
    const element = createTextLine(doc, line);
    element.setAttribute("aria-hidden", "true");
    return { element, line };
  });
  if (titleLines.length > 0) {
    frame.title.replaceChildren(...titleLines.map(({ element }) => element));
    frame.title.setAttribute("aria-label", name);
  }

  const tabs = (chrome.tabs ?? []).flatMap((tab, index) => {
    const hit = shopTabRects(chrome.tabs?.length ?? 0)[index];
    return hit === undefined
      ? []
      : [
          createPageTab(
            doc,
            {
              font: input.fonts.title,
              press: { accepts, burst, press: () => input.tab?.(index) },
            },
            hit,
            tab,
          ),
        ];
  });
  const tabHost = doc.createElement("div");
  tabHost.className = "adw-lines";
  tabHost.append(...tabs.map((tab) => tab.element));
  const tabPart: DomPart = {
    controls: tabs.flatMap((tab) => tab.controls ?? []),
    element: tabHost,
    place: (scale) => tabs.forEach((tab) => tab.place(scale)),
  };
  const scrollbar = bodyScrollbarPart(doc, input.list.clip, () => ({
    ...input.list.scroll(),
    scrollbar: PAGE_LAYOUT.scrollbar,
  }));
  const parts = [
    tabPart,
    ...(input.parts ?? []),
    input.list.part,
    scrollbar,
    ...(input.overlays ?? []),
  ];
  const bodyHost = screenHost(doc);
  bodyHost.element.append(...parts.map((part) => part.element));
  frame.content.append(bodyHost.element);

  const back = createPanelButton(
    doc,
    { fonts: input.fonts, press: { accepts: admits, burst, press: input.back } },
    chrome.back,
  );
  frame.footer.element.append(back.element);
  const footer = {
    actions: [
      {
        element: back.element,
        role: chrome.back.primary ? ("primary" as const) : ("secondary" as const),
        size: { height: chrome.back.rect.height, width: chrome.back.rect.width },
      },
    ],
    // Back's press area is its face.
    context: { press: { margin: 0 } },
  };

  // Phaser handles a press on the page outside its canvas as its own; a press here is the page's.
  for (const type of ["mousedown", "touchstart"]) {
    dialog.addEventListener(type, (event) => event.stopPropagation());
  }
  // Read when used, so a part may change its controls.
  const focusables = () => [...parts.flatMap((part) => part.controls ?? []), back.element];
  dialog.addEventListener("focusin", (event) => {
    const at = focusables().indexOf(event.target as HTMLElement);
    input.onFocus?.(at === -1 ? undefined : at);
  });
  const stopKeys = bindDialogKeys(
    {
      accepts: admits,
      dismissControl: () => back.element,
      focusables,
      ownsKeyboard: () => (input.active?.() ?? true) && lifecycle.ownsKeyboard(),
    },
    dialog,
  );

  // The frame on the art-pixel grid, then each part from the frame's own units.
  let placedScale: DomScale | undefined;
  const place = (scale: DomScale) => {
    placedScale = scale;
    root.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
    root.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
    root.style.transform = gridTransform(scale);
    const { units } = frame.layout(
      {
        ...PAGE_FRAME.context,
        project: { x: (x) => gridX(scale, x), y: (y) => gridY(scale, y) },
      },
      {
        body: 0,
        footer,
        scroll: "game",
        ...(titleLines.length === 0 ? {} : { title: PAGE_FRAME.title }),
      },
    );
    fillHost.place(scale, units.card);
    if (fill !== undefined) {
      placeFrame(scale, SCREEN_CORNER, fill.element, fill.rect);
    }
    for (const { element, line } of titleLines) {
      placeText(input.fonts[line.font], scale, units.title, element, line);
    }
    bodyHost.place(scale, units.body);
    parts.forEach((part) => part.place(scale));
    back.placeContent(scale);
  };
  place(layer.scale());
  const stopScale = layer.onScale(place);
  layer.element.append(root);
  const session = frame.open({ focus: dialog });
  const urls = artUrls(dialog);

  // Scene gestures own the page's content, not Back; their accepted release must not consume
  // Back's browser click.
  let sceneGesture = false;
  const gesture: NativeGesture | undefined =
    input.gesture === undefined
      ? undefined
      : {
          cancel: () => {
            sceneGesture = false;
            input.gesture?.cancel?.();
          },
          down: (event) => {
            sceneGesture = !back.element.contains(event.target as Node);
            if (sceneGesture) {
              input.gesture?.down?.(event);
            }
          },
          move: (event) => {
            if (sceneGesture) {
              input.gesture?.move?.(event);
            }
          },
          up: (event, cancelled) => {
            const active = sceneGesture;
            sceneGesture = false;
            return active ? input.gesture?.up?.(event, cancelled) : false;
          },
        };
  const lifecycle = mountModalLifecycle(
    layer,
    {
      ...(gesture === undefined ? {} : { gesture }),
      modal: false,
      reveal: layer.reveal(
        Promise.all(parts.flatMap((part) => (part.ready === undefined ? [] : [part.ready]))).then(
          (ready) => [...urls, ...ready.flat()],
        ),
        dialog,
      ),
    },
    dialog,
  );
  const stopUnderlay = followModalUnderlay(layer.input, root);
  let dimmed = false;
  return {
    accepts,
    burst: (at) => addTapBurst(layer, at),
    capture: () => lifecycle.capture(),
    destroy: () => {
      stopKeys();
      stopUnderlay();
      scrollbar.dispose();
      tabs.forEach((tab) => tab.dispose());
      back.dispose();
      setRampDimmed(root, false);
      lifecycle.destroy();
      stopScale();
      session.close();
      frame.dispose();
      root.remove();
    },
    element: dialog,
    focusControl: (index) => {
      if (!admits()) {
        return;
      }
      const target = index === undefined ? undefined : focusables()[index];
      const control =
        target?.tagName.toLowerCase() === "button" && target.tabIndex < 0 ? undefined : target;
      if (doc.activeElement !== (control ?? dialog)) {
        focusTarget(control ?? dialog);
      }
    },
    follow: scrollbar.follow,
    refuse: (index, reducedMotion) => {
      if (index === BACK) {
        refuse(reducedMotion, back.element);
      }
    },
    setActionShown: (index, shown) => {
      if (index === BACK && back.element.hidden === shown) {
        back.element.hidden = !shown;
        if (placedScale !== undefined) {
          place(placedScale);
        }
      }
    },
    setDimmed: (next) => {
      dimmed = next;
      setRampDimmed(root, next);
    },
    setEnabled: (enabled) => lifecycle.setEnabled(enabled),
    setFill: (next) => {
      setFillElement(next);
      if (placedScale !== undefined && fill !== undefined) {
        placeFrame(placedScale, SCREEN_CORNER, fill.element, fill.rect);
      }
      dimDrawn(fillHost.element, dimmed);
    },
    setInert: (inert) => lifecycle.setInert(inert),
    setShown: (shown) => lifecycle.setShown(shown),
    tabAt: (target) => {
      const index = tabs.findIndex((tab) => tab.element.contains(target));
      return index < 0 ? undefined : index;
    },
  };
}
