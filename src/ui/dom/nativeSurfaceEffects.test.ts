import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { bindDialogKeys } from "./nativeSurfaceEffects.ts";

function fixture() {
  const doc = new FakeDocument();
  const dialog = doc.createElement("div");
  const controls = Array.from({ length: 3 }, () => doc.createElement("button"));
  dialog.append(...controls);
  const active = { accepts: true };
  bindDialogKeys(
    { accepts: () => active.accepts, focusables: () => controls as unknown as HTMLElement[] },
    dialog as unknown as HTMLElement,
  );
  const key = (code: string, extra = {}) => {
    const event = {
      code,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
      target: doc.activeElement ?? dialog,
      ...extra,
    };
    dialog.fire("keydown", event);
    return event;
  };
  return { active, controls, dialog, doc, key };
}

it("uses every direction family to reach native actions and footer once", () => {
  const { controls, doc, key } = fixture();
  for (const code of ["ArrowDown", "KeyS", "KeyJ"]) {
    const event = key(code);
    expect(doc.activeElement).toBe(controls[["ArrowDown", "KeyS", "KeyJ"].indexOf(code)]);
    expect(event.defaultPrevented).toBe(true);
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  }
  key("KeyK");
  expect(doc.activeElement).toBe(controls[1]);
  key("KeyA");
  expect(doc.activeElement).toBe(controls[0]);
  key("KeyD");
  expect(doc.activeElement).toBe(controls[1]);
});

it("yields owned, editing and composition keys and preserves native confirmation", () => {
  const { active, controls, doc, key } = fixture();
  controls[0]!.focus();
  for (const extra of [
    { defaultPrevented: true },
    { isComposing: true },
    { ctrlKey: true },
    { target: { tagName: "TEXTAREA" } },
  ]) {
    key("KeyS", extra);
    expect(doc.activeElement).toBe(controls[0]);
  }
  expect(key("Enter").defaultPrevented).toBe(false);
  expect(key("NumpadEnter", { repeat: true }).defaultPrevented).toBe(true);
  active.accepts = false;
  key("ArrowDown");
  expect(doc.activeElement).toBe(controls[0]);
});

it("keeps slider horizontal aliases for the value owner while vertical arrows leave the row", () => {
  const { controls, doc, key } = fixture();
  controls[0]!.setAttribute("role", "slider");
  controls[0]!.focus();
  expect(key("ArrowRight").defaultPrevented).toBe(false);
  expect(key("KeyD").defaultPrevented).toBe(false);
  expect(doc.activeElement).toBe(controls[0]);
  key("ArrowDown");
  expect(doc.activeElement).toBe(controls[1]);
});
