import { describe, expect, it } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { dimDrawn, followModalUnderlay, setRampDimmed } from "./rampDim.ts";

const native = (element: ReturnType<FakeDocument["createElement"]>) =>
  element as unknown as HTMLElement;
const cover = (element: HTMLElement) =>
  followModalUnderlay({ accepts: () => false, subscribe: () => () => undefined }, element);

describe("uniform native underlay darkness", () => {
  it("darkens original paint once, including late children and local skins, then restores filters exactly", () => {
    const doc = new FakeDocument();
    const root = doc.createElement("div");
    root.style.setProperty("filter", "contrast(1.2)", "important");
    const child = doc.createElement("span");
    child.style.backgroundColor = "#ead4aa";
    child.style.backgroundImage = 'url("original.png")';
    child.style.setProperty("--ui-button-go", 'url("blob:own-skin")');
    root.append(child);
    const stop = cover(native(root));
    stop.refresh();
    expect(root.style.filter).toBe("contrast(1.2) brightness(0.28)");
    expect(root.style.getPropertyPriority("filter")).toBe("important");
    expect(child.style.backgroundColor).toBe("#ead4aa");
    expect(child.style.backgroundImage).toBe('url("original.png")');
    expect(child.style.getPropertyValue("--ui-button-go")).toBe('url("blob:own-skin")');
    const late = doc.createElement("span");
    late.style.backgroundImage = 'url("late.png")';
    root.replaceChildren(late);
    dimDrawn(native(late), true);
    expect(root.style.filter).toBe("contrast(1.2) brightness(0.28)");
    expect(late.style.filter ?? "").toBe("");
    expect(late.style.backgroundImage).toBe('url("late.png")');
    stop();
    stop();
    stop.refresh();
    expect(root.style.filter).toBe("contrast(1.2)");
    expect(root.style.getPropertyPriority("filter")).toBe("important");
  });

  it("deduplicates nested roots in either acquisition order and transfers coverage when the ancestor closes", () => {
    const doc = new FakeDocument();
    const parent = doc.createElement("div"),
      child = doc.createElement("div");
    parent.style.filter = "none";
    child.style.filter = "saturate(0.8)";
    parent.append(child);
    const stopChild = cover(native(child));
    expect(child.style.filter).toBe("saturate(0.8) brightness(0.28)");
    const stopParent = cover(native(parent));
    expect(parent.style.filter).toBe("brightness(0.28)");
    expect(child.style.filter).toBe("saturate(0.8)");
    stopParent();
    expect(parent.style.filter).toBe("none");
    expect(child.style.filter).toBe("saturate(0.8) brightness(0.28)");
    stopChild();
    const outer = cover(native(parent)),
      inner = cover(native(child));
    expect(parent.style.filter).toBe("brightness(0.28)");
    expect(child.style.filter).toBe("saturate(0.8)");
    inner();
    outer();
    expect(child.style.filter).toBe("saturate(0.8)");
  });

  it("retains independent requests and original accessibility until the final owner releases", () => {
    const doc = new FakeDocument(),
      root = doc.createElement("div");
    root.style.filter = "";
    root.setAttribute("aria-hidden", "false");
    const first = cover(native(root)),
      second = cover(native(root));
    setRampDimmed(native(root), true);
    first();
    expect(root.style.filter).toBe("brightness(0.28)");
    expect(root.inert).toBe(true);
    second();
    expect(root.style.filter).toBe("brightness(0.28)");
    expect(root.inert).toBe(false);
    expect(root.getAttribute("aria-hidden")).toBe("false");
    setRampDimmed(native(root), false);
    expect(root.style.filter).toBe("");
  });

  it("keeps protected sibling top bars and current modals unfiltered while coverage changes", () => {
    const doc = new FakeDocument(),
      layer = doc.createElement("div");
    const under = doc.createElement("div"),
      bar = doc.createElement("div"),
      modal = doc.createElement("div");
    layer.append(under, bar, modal);
    let covered = false,
      sync = () => undefined as void;
    const stop = followModalUnderlay(
      {
        accepts: () => !covered,
        subscribe: (listener) => {
          sync = listener;
          return () => undefined;
        },
      },
      native(under),
    );
    covered = true;
    sync();
    expect(under.style.filter).toBe("brightness(0.28)");
    expect(bar.style.filter ?? "").toBe("");
    expect(modal.style.filter ?? "").toBe("");
    covered = false;
    sync();
    expect(under.style.filter ?? "").toBe("");
    stop();
  });
});
