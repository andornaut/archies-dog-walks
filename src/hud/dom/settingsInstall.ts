import { SETTINGS_CARD } from "../../data/index.ts";
import type { SettingsRowView, SettingsView } from "../../home/index.ts";
import {
  bindPanelFeedback,
  capRows,
  createGameFormRow,
  createTextLine,
  type DomPart,
  type DomQuestionPanel,
  guardNativeInput,
  imageArt,
  sheetArt,
  shownText,
  textBlock,
  textPlace,
  type UiLayer,
} from "../../ui/dom/index.ts";
import { artPixel, type DomScale, lineInk } from "../../ui/index.ts";
import { showQuestionPanel } from "./questionPanel.ts";
import type { DomSettingsInput, RowPart } from "./settingsTypes.ts";

const ORIGIN = { x: 0, y: 0 } as const;

// The kit's own text in a row: its name, note and value word, for screen readers only, since
// the row draws its text in the game's pixel font at the places its view lays out.
export function hideKitText(...parts: readonly HTMLElement[]): void {
  for (const part of parts) {
    part.classList.add("visually-hidden");
  }
}

// The Install row: the kit's one-action row, the whole row its press, with the secondary face of
// the button's size, and on that face its icon and label ink as one centred group.
export function installPart(
  layer: UiLayer,
  input: DomSettingsInput,
  panel: () => Pick<DomQuestionPanel, "accepts" | "capture">,
  burst: (event: PointerEvent) => void,
  row: SettingsRowView,
): RowPart {
  const doc = layer.element.ownerDocument;
  const { button } = row;
  const glyph = row.icon;
  if (button === undefined || glyph === undefined) {
    throw new Error("The Install action requires a face and icon");
  }
  const content = doc.createElement("span");
  content.className = "adw-lines";
  content.setAttribute("aria-hidden", "true");
  const icon = sheetArt(doc, input, glyph.key);
  const label = createTextLine(doc, button.text);
  content.append(icon.element, label);
  const accepts = () => panel().accepts();
  const press = () => input.press.activate({ kind: "install" });
  const view = createGameFormRow(doc, {
    action: {
      className: "adw-standard-button-face adw-face",
      role: "secondary",
      size: { height: button.rect.height, width: button.rect.width },
    },
    className: "adw-row adw-standard-button adw-button adw-secondary",
    getAction: () => (accepts() ? { activate: press } : null),
    label: row.label,
  });
  hideKitText(view.label);
  view.face?.append(content);
  const stopFeedback = bindPanelFeedback(view, { accepts, burst });
  const stopInput = guardNativeInput(
    {
      gate: { accepts, capture: () => panel().capture() },
      holdUnit: () => layer.scale().unit,
      subscribe: layer.input.subscribe,
    },
    view.element,
  );
  return {
    destroy() {
      stopInput();
      stopFeedback();
      view.dispose();
    },
    element: view.element,
    place(scale, placed) {
      const face = placed.face;
      if (face === undefined) {
        return;
      }
      const font = input.fonts.title;
      const pixel = scale.unit * scale.dpr * button.text.scale;
      const ink = lineInk(font, shownText(button.text.font, button.text.text), pixel);
      const height = ink.bottom - ink.top;
      const crop = SETTINGS_CARD.installIconInk;
      const ratio = height / crop.height;
      const iconWidth = crop.width * ratio;
      const gap = SETTINGS_CARD.installGap * scale.unit * scale.dpr;
      const left = (face.width - iconWidth - gap - (ink.right - ink.left)) / 2;
      const top = (face.height - height) / 2;
      icon.place(
        scale,
        button.rect,
        { ...glyph, crop, scale: ratio / artPixel(scale) },
        { left, top },
      );
      const text = textPlace(font, scale, button.rect, button.text);
      Object.assign(label.style, {
        fontSize: `${text.fontSize}px`,
        left: `${left + iconWidth + gap - ink.left}px`,
        lineHeight: `${text.lineHeight}px`,
        top: `${top - ink.top - capRows(font, button.text.font) * pixel}px`,
      });
    },
    ready: icon.ready,
    refuse: () => undefined,
  };
}

// Ids that tie each install steps' card's dialog to its steps.
let stepCards = 0;

// The install steps' card: its title and close control, the glyph of the button the steps start
// from, and the steps, a modal over the page. As a detail card's texts do, the steps are a
// paragraph a screen reader reads and the dialog's description; the glyph is drawn for sight.
export function showSteps(
  layer: UiLayer,
  input: DomSettingsInput,
  steps: NonNullable<SettingsView["steps"]>,
): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  stepCards += 1;
  const text = textBlock(
    doc,
    { fonts: input.fonts, pillColours: () => undefined, spoken: true, tag: "p" },
    steps.steps,
  );
  text.element.id = `adw-install-steps-${stepCards}`;
  const icon = steps.icon === undefined ? undefined : imageArt(doc, input, steps.icon.key);
  const parts: DomPart[] = [
    ...(icon === undefined || steps.icon === undefined
      ? []
      : [
          {
            element: icon.element,
            place: (scale: DomScale) => {
              if (steps.icon !== undefined) {
                icon.place(scale, ORIGIN, steps.icon);
              }
            },
            ready: icon.ready,
          },
        ]),
    { element: text.element, place: (scale) => text.place(scale) },
  ];
  return showQuestionPanel(layer, {
    backgroundCancel: input.closeSteps,
    close: input.closeSteps,
    closeLabel: input.closeLabel,
    describedBy: text.element.id,
    fonts: input.fonts,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: steps.card,
  });
}
