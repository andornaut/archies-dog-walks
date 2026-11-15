import { SCREEN_LAYOUT } from "../../data/screen.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { deviceX, deviceY, gridTransform } from "../../ui/domScale.ts";

const INSET = 2;

// Passive diagnostics use the existing logical road origin and system monospace role.
export function mountDevOverlay(doc: Document, layer: UiLayer) {
  const root = doc.createElement("div");
  const text = doc.createElement("pre");
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    left: "0",
    pointerEvents: "none",
    position: "absolute",
    top: "0",
    transformOrigin: "top left",
    zIndex: "1",
  });
  Object.assign(text.style, {
    backgroundColor: "#000000b3",
    color: "#ffffff",
    fontFamily: "monospace",
    margin: "0",
    position: "absolute",
    whiteSpace: "pre",
    width: "max-content",
  });
  root.append(text);
  layer.element.append(root);
  let shown = false;
  let disposed = false;
  const place = () => {
    if (disposed) {
      return;
    }
    const scale = layer.scale();
    const unit = scale.unit * scale.dpr;
    root.hidden = !shown || !layer.ready();
    root.style.transform = gridTransform(scale);
    Object.assign(text.style, {
      fontSize: `${9 * unit}px`,
      left: `${deviceX(scale, SCREEN_LAYOUT.road.x + INSET)}px`,
      padding: `${2 * unit}px ${3 * unit}px`,
      top: `${deviceY(scale, SCREEN_LAYOUT.road.y + INSET)}px`,
    });
  };
  const offScale = layer.onScale(place);
  const offReady = layer.onReady(place);
  place();
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      offScale();
      offReady();
      root.remove();
    },
    setLines(lines: readonly string[]) {
      text.textContent = lines.join("\n");
    },
    setVisible(visible: boolean) {
      shown = visible;
      place();
    },
    visible: () => !disposed && !root.hidden,
  };
}
