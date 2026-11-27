import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";

import { isConfirmKey, sceneKeyAllowed } from "../../input/index.ts";
import type { NativeGesture } from "../../ui/dom/index.ts";
import { shopTabRects } from "../index.ts";
import type { DomPage } from "./page.ts";
import type { ShopScreenInput, ShopScreenMotion, ShopScreenView } from "./shopScreen.ts";

// The screen supplies live state; gesture identity persists across its page remounts as before.
export function createShopScreenInput(
  context: {
    readonly accepts: () => boolean;
    readonly clip: HTMLElement;
    readonly motion: () => ShopScreenMotion | undefined;
    readonly rowAt: (target: Node) => string | undefined;
    readonly tileElements: () => readonly HTMLElement[];
    readonly view: () => ShopScreenView;
  },
  input: ShopScreenInput,
) {
  let tabGesture: Rect | undefined;
  let rowGesture: string | undefined;
  const point = (event: MouseEvent) => input.toGame({ x: event.clientX, y: event.clientY });
  return {
    mount(page: () => Pick<DomPage, "tabAt">) {
      let tabPress = false;
      const gesture: NativeGesture = {
        cancel: () => {
          tabPress = false;
          tabGesture = undefined;
          rowGesture = undefined;
          input.cancel();
        },
        down: (event) => {
          const tab = page().tabAt(event.target as Node);
          tabGesture = tab === undefined ? undefined : inputTabs(context.view())[tab];
          rowGesture = context.rowAt(event.target as Node);
          tabPress = tab !== undefined;
          if (!tabPress && context.accepts()) {
            input.down(point(event));
          }
        },
        move: (event) => {
          if (!tabPress && context.accepts()) {
            input.move(point(event));
          }
        },
        up: (event, cancelled) => {
          const native = tabPress;
          const position = point(event);
          const leftTab =
            tabGesture !== undefined && !containsPoint(tabGesture, position.x, position.y);
          const view = context.view();
          const row = view.rows.find((row) => row.id === rowGesture);
          const leftRow =
            rowGesture !== undefined &&
            (row === undefined ||
              !containsPoint(view.clip, position.x, position.y) ||
              (view.message !== undefined &&
                containsPoint(view.message.rect, position.x, position.y)) ||
              !containsPoint(row.rect, position.x, position.y + (context.motion()?.scroll.y ?? 0)));
          tabPress = false;
          tabGesture = undefined;
          rowGesture = undefined;
          const handled =
            !native && (cancelled || context.accepts()) ? input.up(position, cancelled) : false;
          return leftTab || leftRow || handled === true;
        },
      };
      return {
        bind(element: HTMLElement) {
          element.addEventListener(
            "wheel",
            (event) => {
              if (context.accepts()) {
                event.preventDefault();
                input.wheel(event.deltaY);
              }
            },
            { passive: false },
          );
          // The page's own controls: its tabs, its rows and Back.
          const onControl = (target: Node) =>
            page().tabAt(target) !== undefined ||
            context.tileElements().some((tile) => tile.contains(target)) ||
            (target !== element && element.contains(target) && !context.clip.contains(target));
          // The page moves focus on Tab and its controls take Enter and Space; every other key is the
          // scene's.
          element.addEventListener("keydown", (event) => {
            if (!context.accepts() || !sceneKeyAllowed(event) || event.code === "Tab") {
              return;
            }
            if (isConfirmKey(event.code) && onControl(event.target as Node)) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            input.key(event.code, event.repeat);
          });
        },
        gesture,
        tab(index: number) {
          const hit = inputTabs(context.view())[index];
          if (hit !== undefined) {
            input.click({ x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 });
          }
        },
      };
    },
  };
}

const inputTabs = (view: ShopScreenView) => shopTabRects(view.page.tabs.length);
