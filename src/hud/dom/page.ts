import { shopTabRects } from "../../home/shopLayout.ts";
import type { PageFill, PageTab } from "../../home/shopPageView.ts";
import { type DomPart, fillPart, framelessView } from "../../ui/dom/parts.ts";
import { dimDrawn, followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import type { DomScale } from "../../ui/domScale.ts";
import type { PanelButton, PanelText } from "../../ui/modal/types.ts";
import { PAGE_LAYOUT } from "../../ui/pageLayout.ts";
import { type BodyScroll, bodyScrollbarPart } from "./bodyScrollbar.ts";
import {
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";
import { createPageTab } from "./shopPage.ts";

// The page template the Pet shop, the Logbook and Help share in HTML over the canvas: a frameless
// page under the live top bar (PAGE_LAYOUT), with no close control. In painting order: its fill,
// its tabs across the tab span (shopTabRects), the page's own parts, its list or body clipped to
// its view, the pages' scrollbar beside it, the page's overlays, its heading and its buttons, with
// Back (pageBack) last. A page is not a modal: the top bar over it keeps its buttons, and a modal
// over it (the Menu, a detail card) dims and stills it with the rest of the background.

export interface PageChrome {
  readonly back: PanelButton;
  // The page's own fill; none where the canvas draws the page.
  readonly fill?: PageFill;
  readonly tabs?: readonly PageTab[];
  readonly title?: readonly PanelText[];
}

export interface DomPageInput extends Pick<
  DomQuestionPanelInput,
  "describedBy" | "fonts" | "gesture" | "gestureOnActions" | "label" | "onFocus" | "toGame"
> {
  // Whether the page's scene takes input, beside the page's own admission.
  readonly active?: () => boolean;
  // What Back does.
  readonly back: () => void;
  // The page's buttons beside Back, as Help's Previous and Next, and what each does.
  readonly buttons?: readonly PanelButton[];
  readonly presses?: DomQuestionPanelInput["presses"];
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

// The page in layer, shown and its dialog focused.
export function showPage(layer: UiLayer, input: DomPageInput): DomPage {
  const doc = layer.element.ownerDocument;
  const { chrome } = input;
  const accepts = () => (input.active?.() ?? true) && shown.accepts();
  const fillHost = doc.createElement("div");
  fillHost.className = "adw-lines";
  let fill = chrome.fill === undefined ? undefined : fillPart(doc, chrome.fill);
  fillHost.append(...(fill === undefined ? [] : [fill.element]));
  let fillScale: DomScale | undefined;
  let dimmed = false;
  const fillHostPart: DomPart = {
    element: fillHost,
    place: (scale) => {
      fillScale = scale;
      fill?.place(scale);
    },
  };
  const tabs = (chrome.tabs ?? []).flatMap((tab, index) => {
    const hit = shopTabRects(chrome.tabs?.length ?? 0)[index];
    return hit === undefined
      ? []
      : [
          createPageTab(
            doc,
            {
              font: input.fonts.title,
              press: {
                accepts,
                burst: (event) => shown.burst(input.toGame({ x: event.clientX, y: event.clientY })),
                press: () => input.tab?.(index),
              },
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
  const shown = showQuestionPanel(layer, {
    close: null,
    // Pages draw no close control, so the label names none.
    closeLabel: "",
    ...(input.describedBy === undefined ? {} : { describedBy: input.describedBy }),
    fonts: input.fonts,
    footerPress: input.back,
    ...(input.gesture === undefined ? {} : { gesture: input.gesture }),
    ...(input.gestureOnActions === undefined ? {} : { gestureOnActions: input.gestureOnActions }),
    ...(input.label === undefined ? {} : { label: input.label }),
    modal: false,
    numberKeys: false,
    ...(input.onFocus === undefined ? {} : { onFocus: input.onFocus }),
    parts: [
      fillHostPart,
      tabPart,
      ...(input.parts ?? []),
      input.list.part,
      scrollbar,
      ...(input.overlays ?? []),
    ],
    presses: input.presses ?? [],
    toGame: input.toGame,
    view: framelessView(PAGE_LAYOUT.rect, {
      buttons: input.buttons ?? [],
      footer: chrome.back,
      title: chrome.title ?? [],
      titleY: chrome.title?.[0]?.capTop ?? PAGE_LAYOUT.rect.y,
    }),
  });
  shown.element.classList.add("adw-picker-surface");
  const stopUnderlay = followModalUnderlay(layer.input, shown.element);
  return {
    ...shown,
    accepts,
    destroy: () => {
      stopUnderlay();
      scrollbar.dispose();
      tabs.forEach((tab) => tab.dispose());
      shown.destroy();
    },
    follow: scrollbar.follow,
    setDimmed: (next) => {
      dimmed = next;
      shown.setDimmed(next);
    },
    setFill: (next) => {
      fill = fillPart(doc, next);
      fillHost.replaceChildren(fill.element);
      if (fillScale !== undefined) {
        fill.place(fillScale);
      }
      dimDrawn(fillHost, dimmed);
    },
    tabAt: (target) => {
      const index = tabs.findIndex((tab) => tab.element.contains(target));
      return index < 0 ? undefined : index;
    },
  };
}
