import { expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { bindDialogKeys } from "./nativeSurfaceEffects.ts";

function fixture(
  options: {
    directionKeys?: false;
    dismissControl?: () => HTMLElement | undefined;
    ownsKeyboard?: () => boolean;
  } = {},
) {
  const doc = new FakeDocument();
  const dialog = doc.createElement("div");
  const controls = Array.from({ length: 3 }, () => doc.createElement("button"));
  dialog.append(...controls);
  doc.body.append(dialog);
  const active = { accepts: true };
  const dispose = bindDialogKeys(
    {
      ...options,
      accepts: () => active.accepts,
      focusables: () => controls as unknown as HTMLElement[],
    },
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
    doc.fire("keydown", event);
    if (!event.defaultPrevented) {
      dialog.fire("keydown", event);
    }
    return event;
  };
  return { active, controls, dialog, dispose, doc, key };
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

it("lets a composed surface own directions while preserving native confirmation and Tab", () => {
  const { controls, doc, key } = fixture({ directionKeys: false });
  expect(key("ArrowDown").defaultPrevented).toBe(false);
  expect(doc.activeElement).not.toBe(controls[0]);
  key("Tab");
  expect(doc.activeElement).toBe(controls[0]);
  expect(key("KeyS").defaultPrevented).toBe(false);
  expect(key("Enter").defaultPrevented).toBe(false);
  expect(key("Enter", { repeat: true }).defaultPrevented).toBe(true);
});

it("dismisses the explicit visible control once on Escape and contains repeats or no-X surfaces", () => {
  let dismissal: HTMLElement | undefined;
  const { controls, key } = fixture({ dismissControl: () => dismissal });
  const click = vi.fn();
  Object.assign(controls[2]!, { click });
  dismissal = controls[2] as unknown as HTMLElement;
  expect(key("Escape").defaultPrevented).toBe(true);
  expect(click).toHaveBeenCalledOnce();
  key("Escape", { repeat: true });
  expect(click).toHaveBeenCalledOnce();
  controls[2]!.hidden = true;
  expect(key("Escape").defaultPrevented).toBe(true);
  expect(click).toHaveBeenCalledOnce();
  dismissal = undefined;
  expect(key("Escape").defaultPrevented).toBe(true);
  expect(click).toHaveBeenCalledOnce();
});

it("contains Escape while pending, throughout teardown and on repeat without reaching a lower surface", () => {
  const doc = new FakeDocument();
  const top = doc.createElement("div");
  const lower = doc.createElement("div");
  const x = doc.createElement("button");
  const back = doc.createElement("button");
  top.append(x);
  lower.append(back);
  doc.body.append(top, lower);
  const state = { lowerPainted: false, owner: "top", painted: false };
  const close = vi.fn(() => {
    state.owner = "lower";
  });
  const dismiss = vi.fn();
  Object.assign(x, { click: close });
  Object.assign(back, { click: dismiss });
  const stopTop = bindDialogKeys(
    {
      accepts: () => state.owner === "top" && state.painted,
      dismissControl: () => x as unknown as HTMLElement,
      focusables: () => [],
      ownsKeyboard: () => state.owner === "top",
    },
    top as unknown as HTMLElement,
  );
  const stopLower = bindDialogKeys(
    {
      accepts: () => state.owner === "lower" && state.lowerPainted,
      dismissControl: () => back as unknown as HTMLElement,
      focusables: () => [],
      ownsKeyboard: () => state.owner === "lower",
    },
    lower as unknown as HTMLElement,
  );
  const escape = (repeat = false) => {
    const event = {
      code: "Escape",
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      repeat,
      stopImmediatePropagation: vi.fn(),
    };
    doc.fire("keydown", event);
    expect(event.defaultPrevented).toBe(true);
  };
  escape();
  expect(close).not.toHaveBeenCalled();
  state.painted = true;
  escape();
  expect(close).toHaveBeenCalledOnce();
  expect(dismiss).not.toHaveBeenCalled();
  escape(true);
  expect(dismiss).not.toHaveBeenCalled();
  state.lowerPainted = true;
  escape(true);
  expect(dismiss).not.toHaveBeenCalled();
  escape();
  expect(dismiss).toHaveBeenCalledOnce();
  stopTop();
  stopLower();
  expect(doc.listeners.get("keydown")).toHaveLength(0);
});
