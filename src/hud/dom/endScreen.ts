import "./logbook.css";

import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { textPart } from "../../home/dom/index.ts";
import {
  badgeStripFaceBottom,
  badgeStripHits,
  type BadgeView,
  type DetailArt,
  type DetailText,
  END_LAYOUT,
  type EndResults,
  type EndScreenView,
} from "../../home/index.ts";
import {
  bindPanelFeedback,
  contentSeparatorPart,
  createGameButton,
  createPanelButton,
  createTextLine,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  type DomTextLine,
  fillPart,
  followModalUnderlay,
  framedPart,
  framelessView,
  panelFramePart,
  placeBox,
  placeText,
  sheetArt,
  type SheetFrame,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  type DomScale,
  gridX,
  gridY,
  PALETTE,
  type PanelText,
  TEXT_SCALE,
} from "../../ui/index.ts";
import type { DomBadgeCardInput } from "./badgeCard.ts";
import { badgeStripParts } from "./celebration.ts";
import { artPart, type DomDetailCardInput } from "./detailCard.ts";
import { showQuestionPanel } from "./questionPanel.ts";

// Native results, controls and authored animation projections.

export interface DomEndScreenInput extends Pick<
  DomDetailCardInput,
  "artUrl" | "fonts" | "loadSheet" | "pillColours"
> {
  readonly badges: readonly BadgeView[];
  readonly closeLabel: DomQuestionPanelInput["closeLabel"];
  readonly everyFrame: DomBadgeCardInput["everyFrame"];
  readonly gesture: NonNullable<DomQuestionPanelInput["gesture"]>;
  readonly home: () => void;
  readonly now: () => number;
  readonly openBadge: (index: number) => void;
  readonly reduced: boolean;
  readonly ribbon:
    { readonly art: DetailArt | undefined; readonly fallback: DomTextLine } | undefined;
  // The display lettering's bitmap font, which lays the title's web font out.
  readonly display: BitmapFont | undefined;
  readonly toGame: DomQuestionPanelInput["toGame"];
  readonly view: EndScreenView;
}

export interface DomEndScreen extends DomQuestionPanel {
  // Back to title pressed, or raised bob game pixels down (whole, as the canvas bobs it).
  setBackToTitle(pressed: boolean, bob: number): void;
  setFace(index: number, frame: SheetFrame | undefined, dy: number): void;
  setBadgePop(index: number, scale: number): void;
  burstBadge(index: number): void;
  setRibbon(alpha: number, dy: number): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// The display lettering's fill colour, which its bitmap font bakes in on the canvas.
const DISPLAY_FILL = PALETTE.yellow;

// The results moved down dy, as the canvas moves their group.
function moved(results: EndResults, dy: number) {
  const point = <T extends Point>(at: T): T => ({ ...at, y: at.y + dy });
  const art = (item: DetailArt): DetailArt => ({
    ...point(item),
    ...(item.centre === undefined ? {} : { centre: point(item.centre) }),
    ...(item.holder === undefined ? {} : { holder: point(item.holder) }),
    ...(item.right === undefined ? {} : { right: point(item.right) }),
  });
  const text = (item: DetailText): DetailText => ({ ...item, capTop: item.capTop + dy });
  const line = (item: PanelText): PanelText => ({ ...item, capTop: item.capTop + dy });
  return {
    art: results.art.map(art),
    band: {
      fill: point(results.band.fill),
      lip: point(results.band.lip),
      outline: point(results.band.outline),
    },
    bubbles: results.bubbles.map(point),
    faces: results.faces.map(point),
    framed: results.framed.map((box) => ({ ...box, rect: point(box.rect) })),
    names: results.names.map(line),
    ownerNames: results.ownerNames,
    ownerRows: {
      ...results.ownerRows,
      art: results.ownerRows.art.map(art),
      texts: results.ownerRows.texts.map(text),
      viewport: point(results.ownerRows.viewport),
    },
    panel: point(results.panel),
    rule: point(results.rule),
    texts: results.texts.map(text),
    title: { ...results.title, capTop: results.title.capTop + dy },
    wells: results.wells.map(point),
  };
}

// Lines of text in parent, each placed as the canvas places it, the whole read as written unless
// the dialog's name already reads it.
function linesPart(
  doc: Document,
  fonts: (line: DomTextLine) => BitmapFont,
  lines: readonly DomTextLine[],
  spoken: boolean | readonly string[] = true,
): DomPart {
  const parent = doc.createElement("p");
  parent.className = "adw-lines";
  const elements = lines.map((line) => {
    const element = createTextLine(doc, line);
    element.setAttribute("aria-hidden", "true");
    parent.append(element);
    return element;
  });
  if (spoken) {
    for (const text of spoken === true ? [lines.map(({ text }) => text).join(" ")] : spoken) {
      const words = doc.createElement("span");
      words.className = "visually-hidden";
      words.textContent = text;
      parent.append(words);
    }
  }
  return {
    element: parent,
    place: (scale) =>
      lines.forEach((line, i) => {
        const element = elements[i];
        if (element !== undefined) {
          placeText(fonts(line), scale, ORIGIN, element, line);
        }
      }),
  };
}

// Back to title: the results screen's main next step, its face and label, pressed or bobbing as
// the scene says.
function backToTitlePart(
  doc: Document,
  fonts: DomEndScreenInput["fonts"],
  input: {
    readonly accepts: () => boolean;
    readonly burst: (event: PointerEvent) => void;
    readonly home: () => void;
  },
  button: EndScreenView["backToTitle"],
): DomPart & { dispose(): void; set(pressed: boolean, bob: number): void } {
  const part = createPanelButton(
    doc,
    {
      fonts,
      press: { accepts: input.accepts, burst: input.burst, press: input.home },
    },
    { ...button, label: button.text.text, primary: true },
  );
  const element = part.element;
  let scale: DomScale | undefined;
  let shown = { bob: 0, pressed: false };
  const show = () => {
    const pressed = element.hasAttribute("data-ui-pressed");
    element.style.transform =
      scale === undefined || pressed || shown.bob === 0
        ? ""
        : `translateY(${shown.bob * artPixel(scale)}px)`;
  };
  return {
    controls: [element],
    dispose: part.dispose,
    element,
    place: (at) => {
      scale = at;
      part.place(at);
      show();
    },
    set(pressed, bob) {
      if (pressed !== shown.pressed) {
        element.toggleAttribute("data-ui-pressed", pressed);
      }
      shown = { bob, pressed };
      show();
    },
  };
}

// Native results and controls share the scene's authored models and animation clock.
export function showEndScreen(layer: UiLayer, input: DomEndScreenInput): DomEndScreen {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  let accepts = () => false;
  const fonts = (line: DomTextLine) =>
    line.font === "display" ? (input.display ?? input.fonts.title) : input.fonts[line.font];
  const results = moved(view.results, view.offsetY);
  const title: DomTextLine = {
    capTop: results.title.capTop,
    centre: "advance",
    centreX: results.title.centreX,
    colour: input.display === undefined ? PALETTE.plum : DISPLAY_FILL,
    font: input.display === undefined ? "title" : "display",
    scale: input.display === undefined ? TEXT_SCALE : 1,
    text: results.title.text,
  };
  const faces = results.faces.map((face) => {
    const art = sheetArt(doc, input, face.key);
    let at: DomScale | undefined;
    let frame: SheetFrame | undefined;
    let dy = 0;
    const paint = () => {
      if (at !== undefined) {
        art.place(at, ORIGIN, {
          projection: "layout",
          tag: face.fired ? "fired" : "happy",
          x: face.x,
          y: face.y + dy,
          ...(frame === undefined ? {} : { frame }),
        });
      }
    };
    return {
      part: {
        element: art.element,
        place: (scale: DomScale) => {
          at = scale;
          paint();
        },
        ready: art.ready,
      },
      set: (next: SheetFrame | undefined, offset: number) => {
        if (frame !== next || dy !== offset) {
          frame = next;
          dy = offset;
          paint();
        }
      },
    };
  });
  const strip = view.strip;
  const badges =
    strip === undefined
      ? undefined
      : badgeStripParts(doc, input, {
          badges: input.badges,
          closes: false,
          panel: strip.panel,
          reduced: input.reduced,
          rows: strip.rows,
        });
  const faceBottom = strip === undefined ? 0 : badgeStripFaceBottom(strip.panel);
  const badgeControls = (
    strip === undefined ? [] : badgeStripHits(strip.panel, strip.rows, input.badges.length)
  ).map((rect, index): DomPart & { readonly hit: Rect; dispose(): void } => {
    const control = createGameButton(doc, {
      appearance: { className: "adw-end-badge-control", face: {} },
      content: {
        icon: doc.createElement("span"),
        kind: "icon",
        name: input.badges[index]?.name ?? "",
      },
      getAction: () => (accepts() ? { activate: () => input.openBadge(index) } : null),
      skin: "authored",
    });
    const { element, face } = control;
    const stopFeedback = bindPanelFeedback(control, {
      accepts: () => accepts(),
      burst: (event) => panel.burst(input.toGame({ x: event.clientX, y: event.clientY })),
    });
    return {
      controls: [element],
      dispose: () => {
        stopFeedback();
        control.dispose();
      },
      element,
      hit: rect,
      // The face, which fills on focus and press, ends on the panel's flat face, above its lip.
      place: (scale) => {
        placeBox(scale, ORIGIN, element, rect);
        placeBox(scale, rect, face, {
          ...rect,
          height: Math.min(rect.y + rect.height, faceBottom) - rect.y,
        });
      },
    };
  });
  const ribbonView = input.ribbon;
  const ribbon =
    ribbonView === undefined
      ? undefined
      : ribbonView.art === undefined
        ? linesPart(doc, fonts, [
            { ...ribbonView.fallback, capTop: ribbonView.fallback.capTop + view.offsetY },
          ])
        : artPart(doc, input, { ...ribbonView.art, y: ribbonView.art.y + view.offsetY });
  const backToTitle = backToTitlePart(
    doc,
    input.fonts,
    {
      accepts: () => accepts(),
      burst: (event) => panel.burst(input.toGame({ x: event.clientX, y: event.clientY })),
      home: input.home,
    },
    view.backToTitle,
  );
  const ownerParts: DomPart[] = [
    contentSeparatorPart(doc, "art", results.rule),
    ...results.wells.map((rect) => fillPart(doc, { colour: PALETTE.tan, rect })),
    ...results.bubbles.map((rect) => panelFramePart(doc, "quip", rect)),
    ...results.ownerRows.art.map((art) => artPart(doc, input, art)),
    ...faces.map(({ part }) => part),
    ...results.ownerRows.texts.map((text) => textPart(doc, input, text)),
    linesPart(doc, fonts, results.names, results.ownerNames),
  ];
  const viewport = doc.createElement("div");
  viewport.className = "adw-scroll-viewport adw-framed";
  const scrolls = results.ownerRows.contentHeight > results.ownerRows.viewport.height;
  viewport.tabIndex = scrolls ? 0 : -1;
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", results.title.text);
  viewport.addEventListener("keydown", (event) => {
    if (
      ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Space"].includes(event.code)
    ) {
      event.stopPropagation();
    }
  });
  const ownerContent = doc.createElement("div");
  ownerContent.className = "adw-framed";
  ownerContent.append(...ownerParts.map(({ element }) => element));
  viewport.append(ownerContent);
  const ownerRows: DomPart = {
    controls: scrolls ? [viewport] : [],
    element: viewport,
    place: (scale) => {
      const { contentHeight, viewport: rect } = results.ownerRows;
      placeBox(scale, ORIGIN, viewport, rect);
      Object.assign(ownerContent.style, {
        height: `${gridY(scale, rect.y + contentHeight)}px`,
        left: `${-gridX(scale, rect.x)}px`,
        top: `${-gridY(scale, rect.y)}px`,
        width: `${gridX(scale, results.panel.x + results.panel.width)}px`,
      });
      ownerParts.forEach((part) => part.place(scale));
    },
    ready: Promise.all(ownerParts.map((part) => part.ready ?? Promise.resolve([]))).then((urls) =>
      urls.flat(),
    ),
  };
  const colours = END_LAYOUT.side.band;
  const badgeNames =
    strip === undefined ? [] : strip.names.map((name) => textPart(doc, input, name));
  // The badges' pictures, confetti and names sit over their controls, whose focus and press fill
  // the whole control under them.
  for (const part of [...(badges?.parts.slice(1) ?? []), ...badgeNames]) {
    part.element.style.setProperty("z-index", "1");
  }
  const parts: DomPart[] = [
    panelFramePart(doc, "plate", results.panel),
    fillPart(doc, { colour: PALETTE[colours.outline], rect: results.band.outline }),
    fillPart(doc, { colour: PALETTE[colours.fill], rect: results.band.fill }),
    fillPart(doc, { colour: PALETTE[colours.lip], rect: results.band.lip }),
    ...results.framed.map((box) => framedPart(doc, box)),
    ...results.art.map((art) => artPart(doc, input, art)),
    ownerRows,
    ...(ribbon === undefined ? [] : [ribbon]),
    linesPart(doc, fonts, [title], false),
    ...results.texts.map((text) => textPart(doc, input, text)),
    ...(badges?.parts ?? []),
    ...(strip === undefined ? [] : [linesPart(doc, fonts, strip.title), ...badgeNames]),
    backToTitle,
    ...badgeControls,
  ];
  const element = doc.createElement("div");
  element.className = "adw-framed";
  // The raised badge parts stay inside the screen's own stacking.
  element.style.isolation = "isolate";
  element.append(...parts.map(({ element }) => element));
  let dimmed = false;
  const underlay = followModalUnderlay(
    {
      accepts: () => !dimmed && layer.input.accepts(),
      subscribe: layer.input.subscribe,
    },
    element,
  );
  const content: DomPart = {
    controls: parts.flatMap((part) => part.controls ?? []),
    element,
    place: (scale) => parts.forEach((part) => part.place(scale)),
    ready: Promise.all(parts.map((part) => part.ready ?? Promise.resolve([]))).then((urls) => {
      underlay.refresh();
      return urls.flat();
    }),
  };
  const screen = { height: 0, width: 0, x: 0, y: 0 };
  let scrolling = false;
  let nativeButtonPress: Rect | undefined;
  const panel = showQuestionPanel(layer, {
    backControl: backToTitle.element,
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    gesture: {
      cancel: () => {
        scrolling = false;
        nativeButtonPress = undefined;
        input.gesture.cancel?.();
      },
      down: (event) => {
        nativeButtonPress = [{ ...backToTitle, hit: view.backToTitle.hit }, ...badgeControls].find(
          ({ element }) => element.contains(event.target as Node),
        )?.hit;
        if (nativeButtonPress) {
          return;
        }
        scrolling = viewport.contains(event.target as Node);
        if (scrolling) {
          input.gesture.cancel?.();
        } else {
          input.gesture.down?.(event);
        }
      },
      move: (event) => {
        if (!scrolling && !nativeButtonPress) {
          input.gesture.move?.(event);
        }
      },
      up: (event, cancelled) => {
        if (nativeButtonPress) {
          const hit = nativeButtonPress;
          nativeButtonPress = undefined;
          const at = input.toGame({ x: event.clientX, y: event.clientY });
          return cancelled || !containsPoint(hit, at.x, at.y);
        }
        const nativeScroll = scrolling;
        scrolling = false;
        return nativeScroll ? false : input.gesture.up?.(event, cancelled);
      },
    },
    label: results.title.text,
    modal: false,
    numberKeys: false,
    parts: [content],
    presses: [],
    toGame: input.toGame,
    view: framelessView(screen),
  });
  accepts = panel.accepts;
  return {
    ...panel,
    burstBadge: (index) => badges?.burst(index),
    destroy: () => {
      accepts = () => false;
      underlay();
      badges?.destroy();
      backToTitle.dispose();
      badgeControls.forEach((control) => control.dispose());
      panel.destroy();
    },
    setBackToTitle: (pressed, bob) => backToTitle.set(pressed, bob),
    setBadgePop: (index, scale) => badges?.setPop(index, scale),
    setDimmed: (value) => {
      dimmed = value;
      underlay.refresh();
    },
    setFace: (index, frame, dy) => faces[index]?.set(frame, dy),
    setRibbon: (alpha, dy) => {
      if (ribbon !== undefined) {
        ribbon.element.style.opacity = String(alpha);
        ribbon.element.style.transform = `translateY(${dy * artPixel(layer.scale())}px)`;
      }
    },
  };
}
