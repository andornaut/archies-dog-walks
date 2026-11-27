import "@andornaut/game-kit/runtime/web/ui/dom/slider.css";

import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { createFormRows } from "@andornaut/game-kit/runtime/web/ui/dom/formRow";

import { type DomPage, showPage } from "../../home/dom/index.ts";
import { settingsFormRows } from "../../home/index.ts";
import {
  addTapBurst,
  createContentSeparator,
  createTextLine,
  cutFrameProperties,
  type DomPart,
  type DomQuestionPanel,
  placeBox,
  placeContentSeparator,
  placeFormRows,
  placeText,
  switchFrames,
  type UiLayer,
} from "../../ui/dom/index.ts";
import { gridY } from "../../ui/index.ts";
import { showSteps } from "./settingsInstall.ts";
import { rowPart, SLIDER_FRAMES } from "./settingsRow.ts";
import type { DomSettings, DomSettingsInput } from "./settingsTypes.ts";

export type { DomSettings, DomSettingsInput } from "./settingsTypes.ts";

// The Settings page in HTML over the canvas, on the page template (showPage): its title, its
// rows scrolling in the page's body with the pages' scrollbar, the version label fixed under the
// body and Back, each row as its view (settingsView) lays it out. A switch row is Game Kit's form
// row, the install row its one-action row and a volume row its slider, in one kit form row list
// that places every row and its icon, switch, face and lane on the art-pixel grid; the kit owns
// their roles, activation, slider keys (the arrows, Home and End) and drags, and draws the
// switch's and slider's frames by their state. The game draws each row's face and text.
// Activations, volumes and a held switch's press go to the scene, which keeps the settings and the
// keyboard's focus; every other key goes through to it, which moves its focus and the page's with
// it. The install steps' card opens over the page as a modal.

const ORIGIN = { x: 0, y: 0 } as const;

// The Settings page in layer, shown and its dialog focused.
export function showSettings(layer: UiLayer, input: DomSettingsInput): DomSettings {
  const doc = layer.element.ownerDocument;
  let current = input.view;
  const burst = (event: PointerEvent) =>
    addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY }));
  const viewport = doc.createElement("div");
  viewport.className = "adw-settings-rows adw-framed";
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", input.view.page.title.map(({ text }) => text).join(" "));
  Object.assign(viewport.style, { scrollbarWidth: "none" });
  const content = doc.createElement("div");
  content.className = "adw-framed";
  viewport.append(content);
  const rows = current.rows.map((_, i) =>
    rowPart(
      layer,
      input,
      () => current,
      () => page,
      i,
      burst,
    ),
  );
  // One kit list places every row: a switch or button row at its own height, a slider row at its
  // slider's.
  const rowList = createFormRows(
    doc,
    settingsFormRows(fontMetrics(input.fonts.title), current.rows[0]!.rect.height),
    { className: "adw-framed adw-form-rows" },
  );
  rowList.element.append(...rows.map((row) => row.element));
  const art = Promise.all([
    switchFrames(doc, input, rowList.element),
    cutFrameProperties(doc, input, content, SLIDER_FRAMES),
  ]);
  const separators = current.separators.map(() => createContentSeparator(doc));
  const build = createTextLine(doc, current.build);
  content.append(rowList.element, ...separators);
  const revealRow = (index: number | undefined) => {
    const row = index === undefined ? undefined : current.rows[index];
    if (row === undefined) {
      return;
    }
    const scale = layer.scale();
    const top = gridY(scale, row.rect.y) - gridY(scale, current.rowsViewport.y);
    const bottom =
      gridY(scale, row.rect.y + row.rect.height) - gridY(scale, current.rowsViewport.y);
    const height =
      gridY(scale, current.rowsViewport.y + current.rowsViewport.height) -
      gridY(scale, current.rowsViewport.y);
    const scroll = viewport.scrollTop || 0;
    viewport.scrollTop = top < scroll ? top : bottom > scroll + height ? bottom - height : scroll;
  };
  const list: DomPart = {
    controls: rows.map((row) => row.element),
    element: viewport,
    place: (scale) => {
      placeBox(scale, ORIGIN, viewport, current.rowsViewport);
      content.style.height = `${
        gridY(scale, current.rowsViewport.y + current.rowsContentHeight) -
        gridY(scale, current.rowsViewport.y)
      }px`;
      content.style.width = "100%";
      const { placed } = placeFormRows(scale, current.rowsViewport, rowList, {
        rect: current.rows[0]!.rect,
        rows: current.rows.map((row, i) => ({
          element: rows[i]!.element,
          ...(i === 0
            ? {}
            : {
                gap: row.rect.y - current.rows[i - 1]!.rect.y - current.rows[i - 1]!.rect.height,
              }),
          ...(row.kind === "slider" ? {} : { height: row.rect.height }),
        })),
      });
      rows.forEach((row, index) => row.place(scale, placed.rows[index]!));
      separators.forEach((element, index) => {
        const rect = current.separators[index];
        if (rect !== undefined) {
          placeContentSeparator(
            scale,
            { origin: current.rowsViewport, projection: "art" },
            element,
            rect,
          );
        }
      });
    },
    ready: Promise.all([...rows.map((row) => row.ready), art]).then((urls) => urls.flat(2)),
  };
  const label: DomPart = {
    element: build,
    place: (scale) =>
      placeText(input.fonts[current.build.font], scale, ORIGIN, build, current.build),
  };
  const page: DomPage = showPage(layer, {
    back: input.close,
    chrome: current.page,
    fonts: input.fonts,
    list: {
      clip: viewport,
      part: list,
      scroll: () => ({
        contentHeight: current.rowsContentHeight,
        viewport: current.rowsViewport,
      }),
    },
    onFocus: (index) => {
      revealRow(index);
      input.onFocus(index ?? null);
    },
    parts: [label],
    toGame: input.toGame,
  });
  let steps: DomQuestionPanel | undefined;
  let shown = true;
  let enabled = true;
  let inert = false;
  let dimmed = false;
  return {
    accepts: () => (steps ?? page).accepts(),
    capture: () => (steps ?? page).capture(),
    destroy() {
      for (const row of rows) {
        row.destroy();
      }
      steps?.destroy();
      page.destroy();
    },
    refuse(index, reducedMotion) {
      rows[index]?.refuse(reducedMotion);
    },
    setDimmed(value) {
      dimmed = value;
      page.setDimmed(value || steps !== undefined);
      steps?.setDimmed(value);
    },
    setEnabled(value) {
      enabled = value;
      page.setEnabled(value);
      steps?.setEnabled(value);
    },
    setInert(value) {
      inert = value;
      page.setInert(value);
      steps?.setInert(value);
    },
    setShown(show) {
      shown = show;
      page.setShown(show);
      steps?.setShown(show);
    },
    update(view, focus) {
      current = view;
      const scale = layer.scale();
      list.place(scale);
      label.place(scale);
      page.follow();
      page.setDimmed(dimmed || view.steps !== undefined);
      if (view.steps !== undefined && steps === undefined) {
        steps = showSteps(layer, input, view.steps);
        steps.setEnabled(enabled);
        steps.setInert(inert);
        steps.setDimmed(dimmed);
        steps.setShown(shown);
      } else if (view.steps === undefined && steps !== undefined) {
        steps.destroy();
        steps = undefined;
        page.setShown(shown);
        page.setDimmed(dimmed);
      }
      if (steps === undefined) {
        revealRow(focus ?? undefined);
        page.focusControl(focus ?? undefined);
      }
    },
  };
}
