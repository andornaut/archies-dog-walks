import { afterEach, describe, expect, it, vi } from "vitest";

import { devToolsOn, pageSearch, watchDevTools } from "./devTools.ts";

function browser() {
  const mode = Object.assign(new EventTarget(), { matches: false });
  const host = Object.assign(new EventTarget(), {
    matchMedia: () => mode,
    navigator: { maxTouchPoints: 0, standalone: false, userAgent: "" },
  });
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("location", { search: "?dev=1" });
  vi.stubGlobal("window", host);
  return { host, mode };
}

afterEach(() => vi.unstubAllGlobals());

describe("browser-only development tools", () => {
  it("rechecks eligibility and excludes URL setup when a tab becomes an app", () => {
    const { host, mode } = browser();
    expect(devToolsOn()).toBe(true);
    expect(pageSearch()).toBe("?dev=1");
    mode.matches = true;
    expect(devToolsOn()).toBe(false);
    expect(pageSearch()).toBe("");
    mode.matches = false;
    host.navigator.standalone = true;
    expect(devToolsOn()).toBe(false);
  });

  it("updates effective effects on display changes and restoration, and stops on disposal", () => {
    const { host, mode } = browser();
    const changed = vi.fn();
    const stop = watchDevTools(changed);
    mode.matches = true;
    mode.dispatchEvent(new Event("change"));
    mode.matches = false;
    host.dispatchEvent(new Event("pageshow"));
    host.navigator.standalone = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(changed.mock.calls).toEqual([[true], [false], [true], [false]]);
    stop();
    mode.dispatchEvent(new Event("change"));
    host.dispatchEvent(new Event("pageshow"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(changed).toHaveBeenCalledTimes(4);
  });
});
