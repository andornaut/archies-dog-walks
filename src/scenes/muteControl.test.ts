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
  const parent = Object.assign(doc.createElement("div"), { clientHeight: 560, clientWidth: 360 });
  const created = vi.spyOn(doc, "createElement");
  const remove = mountMuteControl(settings, parent as unknown as HTMLElement);
  // The control's art is inlined, so the crash screen loads no file for it.
  const button = parent.all().find((node) => node.tagName === "button")!;
  expect(button.style.getPropertyValue("--mute-chrome")).toBe(`url("${crashArt.chrome}")`);
  const icon = created.mock.results.find(({ value }) => value.tagName === "img")?.value as {
    src: string;
  };
  expect(icon.src).toBe(crashArt.sound);
  for (const url of [crashArt.chrome, crashArt.sound]) {
    const image = decodePng(Buffer.from(url.replace(/^data:image\/png;base64,/, ""), "base64"));
    expect(image.width).toBeGreaterThan(0);
  }
  expect(parent.children[0]?.style.getPropertyValue("--mute-cyan")).toBe(
    `#${PALETTE.cyan.toString(16)}`,
  );
  expect(button.getAttribute("aria-label")).toBe(MENU_TEXT.settings.sound);
  expect(button.getAttribute("aria-pressed")).toBe("false");
  button.fire("click");
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
