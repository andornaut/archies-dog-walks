import "@andornaut/game-kit/runtime/web/ui/dom/modalFrame.css";

import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { createModalFrame } from "@andornaut/game-kit/runtime/web/ui/dom/modalFrame";

import { type DomScale, frameRect } from "../../ui/index.ts";

// The shared card owns its projected box and the one authored skin. Header, content and controls
// still use the question view's screen origins; the modal lifecycle owns admission and focus.
export function createQuestionCardFrame(
  doc: Document,
  input: { readonly id: string; readonly panel: Rect; readonly title: string },
): {
  readonly element: HTMLElement;
  readonly title: HTMLElement;
  dispose(): void;
  place(scale: DomScale): void;
} {
  const frame = createModalFrame(doc, { id: input.id, title: input.title });
  // The existing full-screen dialog remains the accessible and focusable modal root. The kit's
  // card is the painted box underneath its screen-origin content, not a second dialog.
  frame.card.removeAttribute("role");
  frame.card.removeAttribute("aria-labelledby");
  frame.card.style.pointerEvents = "none";
  frame.card.style.touchAction = "auto";
  frame.skin.classList.add("adw-card");
  // The native lifecycle supplies its own backdrop. Its reveal gate, companions and walk hold
  // remain independent of this frame's geometry; no second modal session is opened here.
  frame.backdrop.hidden = true;
  frame.header.hidden = true;
  frame.body.hidden = true;
  frame.footerSlot.hidden = true;
  frame.element.append(frame.title);
  return {
    dispose: () => frame.dispose(),
    element: frame.element,
    place(scale) {
      const box = frameRect(scale, input.panel);
      // The view already projects its authored frame onto whole art pixels. Feed that exact
      // box to the kit in device-pixel space, which the existing dialog transform scales once.
      frame.layout(
        {
          content: { height: box.height, width: box.width, x: box.left, y: box.top },
          families: { authored: box.width },
          family: "authored",
          gap: 0,
          margin: 0,
          padding: 0,
          project: { x: (x) => x, y: (y) => y },
          variant: "card",
        },
        { body: box.height, scroll: "game", title: { height: 0, inset: 0 } },
      );
    },
    title: frame.title,
  };
}
