import { decodePng } from "@andornaut/art-kit/build/png";
import crashArt from "virtual:adw-crash-art";
import { afterEach, expect, it, vi } from "vitest";

import { MENU_TEXT } from "../data/menuText.ts";
import { DeviceSettings, SETTINGS_KEYS } from "../save/settings.ts";
import { FakeDocument } from "../testing/fakeDom.ts";
import { mountMuteControl } from "../ui/dom/muteControl.ts";
import { PALETTE } from "../ui/palette.ts";

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
  expect(button.getAttribute("aria-pressed")).toBe("false");
  button.focus();
  button.fire("click");
  expect(doc.activeElement).toBe(button);
  expect(settings.current.muted).toBe(true);
  expect(entries.get(SETTINGS_KEYS.muted)).toBe("on");
  expect(entries.size).toBe(1);
  settings.setMuted(false);
  expect(button.getAttribute("aria-pressed")).toBe("false");
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
    expect(button.getAttribute("aria-pressed")).toBe("true");
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
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(doc.activeElement).toBe(button);
  remove();
});
