import { expect, it } from "vitest";

import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { domScale, frameRect, gridY } from "../../ui/domScale.ts";
import { createQuestionCardFrame } from "./questionCardFrame.ts";

it.each([
  { dpr: 2, width: 360 },
  { dpr: 2.625, width: 412 },
  { dpr: 3, width: 390 },
])(
  "keeps the authored card's projected box and single skin at $width DPR $dpr",
  ({ dpr, width }) => {
    const doc = new FakeDocument();
    const scale = domScale(dpr, { height: 844, width, x: 0, y: 0 });
    const { layer } = fakeLayer(doc, scale);
    const panel = { height: 263, width: 328, x: 16, y: 73 };
    const actionHit = { height: 48, width: 84, x: 138, y: 268 };
    const frame = createQuestionCardFrame(layer.element.ownerDocument, {
      actionHits: [actionHit],
      id: "authored-card",
      panel,
      title: "A card",
      titleLines: [
        {
          capTop: 97,
          centre: "ink",
          centreX: 180,
          colour: 0,
          font: "title",
          line: 0,
          scale: 1,
          text: "A card",
        },
      ],
    });
    layer.element.append(frame.element);
    frame.place(scale);
    const root = frame.element as unknown as FakeElement;
    const card = root.all().find((node) => node.classList.contains("ui-modal-card"))!;
    const skins = root.all().filter((node) => node.classList.contains("adw-card"));
    const box = frameRect(scale, panel);
    expect(skins).toHaveLength(1);
    expect(skins[0]?.parent).toBe(card);
    expect(card.style["--ui-modal-card-x"]).toBe(String(box.left));
    expect(card.style["--ui-modal-card-y"]).toBe(String(box.top));
    expect(card.style["--ui-modal-card-width"]).toBe(String(box.width));
    expect(card.style["--ui-modal-card-height"]).toBe(String(box.height));
    expect(root.getAttribute("data-ui-modal-projected")).toBe("");
    expect(card.getAttribute("role")).toBeNull();
    const slot = (name: string) => root.all().find((node) => node.classList.contains(name))!;
    const cssNumber = (element: FakeElement, name: string) =>
      Number.parseFloat(element.style[name]!);
    const frameTitle = frame.title as unknown as FakeElement;
    expect(frameTitle.parent).toBe(slot("ui-modal-header"));
    expect(frameTitle.children).toContain(frame.titleLines);
    expect(frameTitle.textContent).toBe("");
    expect(slot("ui-modal-content").children).toContain(frame.body);
    expect(slot("ui-modal-footer").children).toContain(frame.actions);
    const titleX = box.left + cssNumber(card, "--ui-modal-title-x");
    const titleY =
      box.top + cssNumber(card, "--ui-modal-header-y") + cssNumber(card, "--ui-modal-title-y");
    expect(cssNumber(frame.titleLines as unknown as FakeElement, "left")).toBe(-titleX);
    expect(cssNumber(frame.titleLines as unknown as FakeElement, "top")).toBe(-titleY);
    expect(cssNumber(frame.body as unknown as FakeElement, "left")).toBe(-box.left);
    expect(cssNumber(frame.body as unknown as FakeElement, "top")).toBe(
      -(box.top + cssNumber(card, "--ui-modal-body-y")),
    );
    expect(cssNumber(frame.actions as unknown as FakeElement, "left")).toBe(-box.left);
    expect(cssNumber(frame.actions as unknown as FakeElement, "top")).toBe(
      -gridY(scale, actionHit.y),
    );
    expect(root.all().find((node) => node.classList.contains("ui-modal-backdrop"))?.hidden).toBe(
      true,
    );
    frame.dispose();
    // The caller removes the root only after its modal lifecycle has restored focus.
    expect(root.parent).toBe(layer.element);
  },
);
