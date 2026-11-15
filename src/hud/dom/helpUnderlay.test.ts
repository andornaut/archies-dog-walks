import { expect, it } from "vitest";

import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { coverHelpUnderlay } from "./helpUnderlay.ts";

function display(element: FakeElement, value = "", priority = "") {
  let current = value;
  let weight = priority;
  Object.assign(element, { isConnected: true });
  Object.assign(element.style, {
    getPropertyPriority: () => weight,
    getPropertyValue: () => current,
    setProperty: (_key: string, next: string, importance = "") => {
      current = next;
      weight = importance;
    },
  });
  return Object.assign(() => [current, weight], {
    set: (next: string, importance: string) => {
      current = next;
      weight = importance;
    },
  });
}

it("hides only prior native roots and restores their exact visual state before modal focus returns", () => {
  const doc = new FakeDocument();
  const layer = doc.createElement("div");
  const home = doc.createElement("div");
  const hidden = doc.createElement("div");
  const bursts = doc.createElement("div");
  bursts.className = "adw-bursts";
  home.inert = true;
  hidden.hidden = true;
  const homeDisplay = display(home, "grid");
  const hiddenDisplay = display(hidden, "none", "important");
  const burstDisplay = display(bursts);
  layer.append(home, hidden, bursts);
  const restore = coverHelpUnderlay(layer as unknown as HTMLElement);
  const help = doc.createElement("div");
  const picture = doc.createElement("div");
  const menu = doc.createElement("div");
  const helpDisplay = display(help);
  const pictureDisplay = display(picture);
  const menuDisplay = display(menu);
  layer.append(help, picture, menu);
  expect(homeDisplay()).toEqual(["none", "important"]);
  expect(hiddenDisplay()).toEqual(["none", "important"]);
  expect(burstDisplay()).toEqual(["", ""]);
  expect(helpDisplay()).toEqual(["", ""]);
  expect(pictureDisplay()).toEqual(["", ""]);
  expect(menuDisplay()).toEqual(["", ""]);
  // Dismissing Help's own Menu leaves the original page covered until Help closes.
  menu.remove();
  expect(homeDisplay()).toEqual(["none", "important"]);
  restore();
  expect(homeDisplay()).toEqual(["grid", ""]);
  expect(hiddenDisplay()).toEqual(["none", "important"]);
  expect(home.inert).toBe(true);
  expect(hidden.hidden).toBe(true);
  home.inert = false;
  home.focus();
  expect(doc.activeElement).toBe(home);
  restore();
  expect(homeDisplay()).toEqual(["grid", ""]);
});

it("keeps persistent-root redraws covered and leaves removed or newly owned roots unchanged", () => {
  const doc = new FakeDocument();
  const layer = doc.createElement("div");
  const home = doc.createElement("div");
  const removed = doc.createElement("div");
  const changed = doc.createElement("div");
  const homeDisplay = display(home);
  const removedDisplay = display(removed);
  const changedDisplay = display(changed);
  layer.append(home, removed, changed);
  const restore = coverHelpUnderlay(layer as unknown as HTMLElement);
  home.replaceChildren(doc.createElement("button"));
  expect(homeDisplay()).toEqual(["none", "important"]);
  removed.remove();
  changedDisplay.set("flex", "important");
  restore();
  expect(homeDisplay()).toEqual(["", ""]);
  expect(removedDisplay()).toEqual(["none", "important"]);
  expect(changedDisplay()).toEqual(["flex", "important"]);
});
