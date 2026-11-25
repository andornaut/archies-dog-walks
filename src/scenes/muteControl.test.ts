import { decodePng } from "@andornaut/art-kit/build/png";
import crashArt from "virtual:adw-crash-art";
import { afterEach, expect, it, vi } from "vitest";

import { MENU_TEXT } from "../data/menuText.ts";
import { DeviceSettings, SETTINGS_KEYS } from "../save/settings.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import { mountMuteControl, STATE_WORD_CAP_TOP } from "../ui/dom/muteControl.ts";
import { PALETTE } from "../ui/palette.ts";
import { TITLE_CAP_ROWS } from "../ui/textFit.ts";
import { TOP_BAR_FACE } from "../ui/topBarTrim.ts";
import { topBarGlyphRect, topSectionLayout } from "../ui/topSection.ts";

afterEach(() => vi.unstubAllGlobals());

it("shares pre-profile mute with the device settings, follows external changes and disposes input", () => {
  const entries = new Map<string, string>();
  const settings = new DeviceSettings(
    {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => {
        entries.set(key, value);
      },
    },
    false,
  );
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnect;
    },
  );
  const doc = new FakeDocument();
  const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  doc.body.append(parent);
  const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
  // The control draws the top bar's Sound from inlined art, so the crash screen loads no file.
  const button = parent.all().find((node) => node.tagName === "button")!;
  expect(button.classList.contains("adw-top-section-button")).toBe(true);
  expect(button.getAttribute("data-ui-button-role")).toBe("navigation");
  const images = parent
    .all()
    .map((node) => node.style.backgroundImage)
    .filter(Boolean);
  expect(images).toEqual(
    [crashArt.face, crashArt.facePressed, crashArt.sound].map((url) => `url("${url}")`),
  );
  for (const url of [crashArt.face, crashArt.facePressed, crashArt.sound]) {
    const image = decodePng(Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64"));
    expect(image.width).toBeGreaterThan(0);
  }
  expect(parent.children[0]?.style.getPropertyValue("--adw-cyan")).toBe(
    `#${PALETTE.cyan.toString(16)}`,
  );
  expect(button.getAttribute("aria-label")).toBe(MENU_TEXT.settings.sound);
  expect(button.getAttribute("role")).toBeNull();
  expect(button.getAttribute("aria-pressed")).toBe("true");
  button.focus();
  button.fire("click");
  expect(doc.activeElement).toBe(button);
  expect(settings.current.muted).toBe(true);
  expect(entries.get(SETTINGS_KEYS.muted)).toBe("on");
  expect(entries.size).toBe(1);
  settings.setMuted(false);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  const key = { code: "KeyM", preventDefault: vi.fn(), repeat: false, stopPropagation: vi.fn() };
  doc.defaultView.fire("keydown", key);
  expect(settings.current.muted).toBe(true);
  expect(key.preventDefault).toHaveBeenCalledOnce();
  doc.defaultView.fire("keydown", { ...key, repeat: true });
  expect(settings.current.muted).toBe(true);
  remove();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(parent.children).toEqual([]);
  doc.defaultView.fire("keydown", key);
  expect(settings.current.muted).toBe(true);
});

it("ignores the inert loading endpoint when the crash endpoint owns the same window", () => {
  const settings = new DeviceSettings(undefined, false);
  const changed = vi.fn();
  const stop = settings.onChange(changed);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const doc = new FakeDocument();
  const boot = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  const crash = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  doc.body.append(boot, crash);
  const removeBoot = mountMuteControl(settings, boot as unknown as HTMLElement);
  boot.inert = true;
  const removeCrash = mountMuteControl(settings, crash as unknown as HTMLElement);
  doc.defaultView.fire("keydown", {
    code: "KeyM",
    preventDefault: vi.fn(),
    repeat: false,
    stopPropagation: vi.fn(),
  });
  expect(settings.current.muted).toBe(true);
  expect(changed).toHaveBeenCalledOnce();
  removeBoot();
  removeCrash();
  stop();
});

it.each(["hidden", "inert"] as const)(
  "rechecks a %s standalone endpoint before native activation and restores its current state",
  (barrier) => {
    const settings = new DeviceSettings(undefined, false);
    const doc = new FakeDocument();
    const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
    doc.body.append(parent);
    const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
    const button = parent.all().find((node) => node.tagName === "button")!;
    const click = () =>
      button.fire("click", { preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() });
    parent[barrier] = true;
    click();
    expect(settings.current.muted).toBe(false);
    parent[barrier] = false;
    click();
    expect(settings.current.muted).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("false");
    doc.hidden = true;
    click();
    expect(settings.current.muted).toBe(true);
    remove();
    doc.hidden = false;
    click();
    expect(settings.current.muted).toBe(true);
  },
);

it.each([
  ["a pointer", { button: 0, isPrimary: true, pointerId: 1 }, "pointerdown", "pointerup"],
  ["Space", { code: "Space", repeat: false }, "keydown", "keyup"],
] as const)("holds the top bar's pressed face while %s holds it", (_, event, down, up) => {
  const settings = new DeviceSettings(undefined, false);
  const doc = new FakeDocument();
  const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  doc.body.append(parent);
  const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
  const button = parent.all().find((node) => node.tagName === "button")!;
  const part = (name: string) =>
    parent.all().filter((node) => node.classList.contains(`adw-${name}`));
  const [face, glyph] = [part("standalone-mute-face"), part("standalone-mute-glyph")[0]!];
  const [, control] = topSectionLayout(["mute", "menu"]).controls[0]!;
  const look = () => ({
    face: face.map((node) => !node.hidden),
    glyph: Number.parseFloat(glyph.style.top!),
    pressed: button.hasAttribute("data-ui-pressed"),
  });
  const glyphTop = (pressed: boolean) => topBarGlyphRect(control.face, pressed).y - control.face.y;
  expect(look()).toEqual({ face: [true, false], glyph: glyphTop(false), pressed: false });
  button.fire(down, { ...event });
  expect(look()).toEqual({ face: [false, true], glyph: glyphTop(true), pressed: true });
  button.fire(up, { ...event });
  expect(look()).toEqual({ face: [true, false], glyph: glyphTop(false), pressed: false });
  remove();
});

it.each([false, true])(
  "reports Sound pressed only while on and shows its state below the face (muted %s)",
  (muted) => {
    const settings = new DeviceSettings(undefined, false);
    settings.setMuted(muted);
    const doc = new FakeDocument();
    const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
    doc.body.append(parent);
    const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
    const button = parent.all().find((node) => node.tagName === "button")!;
    const word = parent.all().find((node) => node.className === "adw-standalone-mute-state")!;
    expect(button.getAttribute("aria-label")).toBe(MENU_TEXT.settings.sound);
    expect(button.getAttribute("aria-pressed")).toBe(String(!muted));
    expect(word.getAttribute("aria-hidden")).toBe("true");
    expect(word.textContent).toBe(
      (muted ? MENU_TEXT.settings.off : MENU_TEXT.settings.on).toUpperCase(),
    );
    // The word's capitals lie between the face's bottom and the hit box's, centred on the face.
    const [, { face, hit }] = topSectionLayout(["mute", "menu"]).controls[0]!;
    const capTop = Number.parseFloat(word.style.top!) + STATE_WORD_CAP_TOP;
    expect(capTop).toBeGreaterThanOrEqual(face.y + TOP_BAR_FACE.size);
    expect(capTop + TITLE_CAP_ROWS).toBeLessThanOrEqual(hit.y + hit.height);
    const left = Number.parseFloat(word.style.left!);
    expect(left + Number.parseFloat(word.style.width!) / 2).toBe(face.x + TOP_BAR_FACE.size / 2);
    expect(word.style.textAlign).toBe("center");
    settings.setMuted(!muted);
    expect(button.getAttribute("aria-pressed")).toBe(String(muted));
    expect(word.textContent).toBe(
      (muted ? MENU_TEXT.settings.on : MENU_TEXT.settings.off).toUpperCase(),
    );
    remove();
  },
);

// Ink 11 columns wide, a column right of the pen, and 14 wide from the pen.
it.each([
  [MENU_TEXT.settings.on, { actualBoundingBoxLeft: -1, actualBoundingBoxRight: 12 }],
  [MENU_TEXT.settings.off, { actualBoundingBoxLeft: 0, actualBoundingBoxRight: 14 }],
])("centres the %s state word's ink on the face, a half rounded up", (word, ink) => {
  const settings = new DeviceSettings(undefined, false);
  settings.setMuted(word === MENU_TEXT.settings.off);
  const doc = new FakeDocument();
  const create = doc.createElement.bind(doc);
  vi.spyOn(doc, "createElement").mockImplementation((tagName) =>
    tagName === "canvas"
      ? Object.assign(create(tagName), { getContext: () => ({ font: "", measureText: () => ink }) })
      : create(tagName),
  );
  const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  doc.body.append(parent);
  const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
  const state = parent.all().find((node) => node.className === "adw-standalone-mute-state")!;
  const [, { face }] = topSectionLayout(["mute", "menu"]).controls[0]!;
  const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight;
  const inkLeft = Number.parseFloat(state.style.left!) - ink.actualBoundingBoxLeft;
  expect(state.textContent).toBe(word.toUpperCase());
  expect(Number.isInteger(inkLeft)).toBe(true);
  expect([0, 0.5]).toContain(inkLeft + width / 2 - (face.x + TOP_BAR_FACE.size / 2));
  expect(state.style.textAlign).toBe("left");
  remove();
});
