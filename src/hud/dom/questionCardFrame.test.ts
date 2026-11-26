import { expect, it } from "vitest";

import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { domScale, frameRect } from "../../ui/domScale.ts";
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
    const frame = createQuestionCardFrame(layer.element.ownerDocument, {
      id: "authored-card",
      panel,
      title: "A card",
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
    expect(root.children).toContain(frame.title);
    expect(root.all().find((node) => node.classList.contains("ui-modal-backdrop"))?.hidden).toBe(
      true,
    );
    frame.dispose();
    // The caller removes the root only after its modal lifecycle has restored focus.
    expect(root.parent).toBe(layer.element);
  },
);
