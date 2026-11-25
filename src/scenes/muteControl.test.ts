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
import { topSectionLayout } from "../ui/topSection.ts";

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
  vi.spyOn(doc, "createElementNS").mockImplementation(() => {
    throw new Error("SVG unavailable");
  });
  const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  doc.body.append(parent);
  const created = vi.spyOn(doc, "createElement");
  const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
  // The control's art is inlined, so the crash screen loads no file for it.
  const button = parent.all().find((node) => node.tagName === "button")!;
  expect(button.classList.contains("adw-standard-button")).toBe(true);
  expect(button.children[0]?.classList.contains("adw-standard-button-face")).toBe(true);
  const icon = created.mock.results.find(({ value }) => value.tagName === "img")?.value as {
    src: string;
  };
  expect(icon.src).toBe(crashArt.sound);
  for (const url of [crashArt.sound]) {
    const image = decodePng(Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64"));
    expect(image.width).toBeGreaterThan(0);
  }
  expect(parent.children[0]?.style.getPropertyValue("--adw-cyan")).toBe(
    `#${PALETTE.cyan.toString(16)}`,
  );
  expect(button.getAttribute("aria-label")).toBe(MENU_TEXT.settings.sound);
  expect(button.getAttribute("role")).toBeNull();
  expect(parent.all().some((node) => node.tagName === "svg")).toBe(false);
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

it("uses the shared inline sound glyph when SVG is available without moving native focus", () => {
  const settings = new DeviceSettings(undefined, false);
  const doc = new FakeDocument();
  const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  doc.body.append(parent);
  const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
  const button = parent.all().find((node) => node.tagName === "button")!;
  const first = parent.all().find((node) => node.tagName === "svg")!;
  expect(first).toBeDefined();
  expect(first.getAttribute("aria-hidden")).toBe("true");
  expect(first.getAttribute("focusable")).toBe("false");
  expect(button.getAttribute("aria-label")).toBe(MENU_TEXT.settings.sound);
  expect(button.getAttribute("role")).toBeNull();
  button.focus();
  settings.setMuted(true);
  const second = parent.all().find((node) => node.tagName === "svg")!;
  expect(second).toBeDefined();
  expect(second).not.toBe(first);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(doc.activeElement).toBe(button);
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
    settings.setMuted(!muted);
    expect(button.getAttribute("aria-pressed")).toBe(String(muted));
    expect(word.textContent).toBe(
      (muted ? MENU_TEXT.settings.on : MENU_TEXT.settings.off).toUpperCase(),
    );
    remove();
  },
);
