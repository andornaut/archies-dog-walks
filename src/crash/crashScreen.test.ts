import { afterEach, expect, it, vi } from "vitest";

import { MENU_TEXT } from "../data/menuText";

vi.mock("virtual:art-files", () => ({
  default: new Map([["sprites/face-dog-archie.png", "assets/art/face-dog-archie-test.png"]]),
}));

class Element extends EventTarget {
  readonly attributes = new Map<string, string>();
  readonly children: Element[] = [];
  readonly style = { setProperty: vi.fn() };
  className = "";
  id = "";
  textContent = "";
  focus = vi.fn();
  append(...children: (Element | string)[]): void {
    for (const child of children) {
      if (typeof child === "string") {
        this.textContent += child;
      } else {
        this.children.push(child);
      }
    }
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force: boolean): void {
    if (force) {
      this.attributes.set(name, "");
    } else {
      this.attributes.delete(name);
    }
  }
}

const descendants = (element: Element): Element[] => [
  element,
  ...element.children.flatMap(descendants),
];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("shows the renderer-independent native crash fallback and retains reload and private details", async () => {
  const body = new Element();
  const game = new Element();
  body.append(game);
  const root = new Element();
  const window = new EventTarget();
  Object.assign(window, { matchMedia: () => ({ matches: false }), navigator: {} });
  const reload = vi.fn();
  vi.stubGlobal("document", { body, createElement: () => new Element(), documentElement: root });
  vi.stubGlobal("window", window);
  vi.stubGlobal("location", { reload, search: "" });
  const { CRASH_SCREEN } = await import("./crashScreen");
  const stop = vi.fn();
  CRASH_SCREEN.stopGameOnCrash(stop);
  const event = Object.assign(new Event("error"), {
    error: new Error("private stack details"),
    filename: "/src/main.ts",
    message: "private stack details",
  });
  window.dispatchEvent(event);
  const screen = body.children[1];
  expect(screen?.attributes.get("role")).toBe("alertdialog");
  expect(game.attributes.has("inert")).toBe(true);
  expect(stop).toHaveBeenCalledTimes(1);
  const content = descendants(screen ?? body);
  expect(content.map((element) => element.textContent)).toContain(MENU_TEXT.crash.title);
  expect(content.map((element) => element.textContent).join("\n")).not.toContain(
    "private stack details",
  );
  const button = content.find((element) => element.className === "crash-button");
  button?.dispatchEvent(new Event("click"));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(root.style.setProperty).toHaveBeenCalledWith(
    "--crash-pose-image",
    'url("/assets/art/face-dog-archie-test.png")',
  );
  expect(root.style.setProperty).toHaveBeenCalledWith(
    "--crash-paper",
    expect.stringMatching(/^#[0-9a-f]{6}$/i),
  );
});
