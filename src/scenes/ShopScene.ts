import { clampIndex } from "@andornaut/game-kit/runtime/arrays";
import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { advanceWidth, type BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { Scene } from "phaser";

import { domArtUrl } from "../assets/domArtFiles.ts";
import { dogFaceKey, gearIconKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { dogDetail, gearDetail } from "../home/detail.ts";
import { FEEDBACK, shakeOffset } from "../home/feedback.ts";
import { focusDirectionForKey } from "../home/focus.ts";
import { type Purchase } from "../home/home.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { type HomeAction, messageLine } from "../home/homeLines.ts";
import { pricePlateView } from "../home/pricePlateView.ts";
import {
  answerPurchase,
  type ConfirmChoice,
  confirmLines,
  keyAnswer,
  type PendingPurchase,
  requestPurchase,
} from "../home/purchaseConfirm.ts";
import {
  dogRows,
  gearRows,
  ownedCountNote,
  SHOP_ROW_VIEWS,
  SHOP_TABS,
  shopOpenTab,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  slotRows,
} from "../home/shop.ts";
import { shopFocusView } from "../home/shopFocusView.ts";
import {
  rowRects,
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopListFrame,
  shopMessageLayout,
  shopNextHeading,
  shopRowHeight,
  shopRowsBottom,
  shopRowTextRoom,
  shopRowTextTops,
  shopScrollbar,
  shopTabRects,
} from "../home/shopLayout.ts";
import { shopPageView } from "../home/shopPageView.ts";
import { addTapBurst as addNativeTapBurst } from "../hud/dom/questionPanel.ts";
import {
  type NativeShopScreen,
  type ShopScreenRow,
  type ShopScreenView,
  showShopScreen,
} from "../hud/dom/shopScreen.ts";
import {
  type HoldPress,
  holdRule,
  moveHold,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "../input/hold.ts";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import {
  dragScroll,
  isDragging,
  type ListScroll,
  listScroll,
  pageKeyScroll,
  pressScroll,
  releaseScroll,
  resizeScroll,
  scrollMax,
  scrollToShow,
  stepScroll,
  wheelScroll,
} from "../input/listScroll.ts";
import { dollarText } from "../presentation/currency.ts";
import type { SaveDocument } from "../save/schema.ts";
import { disabledArtKey } from "../ui/disabledArt.ts";
import { shownText } from "../ui/dom/pixelLine.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import type { PanelMeasure, PanelText } from "../ui/modal/types.ts";
import { PALETTE } from "../ui/palette.ts";
import { GREYED, pictureBox, selectLook } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import type { CelebrationSceneData } from "./CelebrationScene.ts";
import { listenHomeBar, sceneRegionOutside } from "./homeBarPress.ts";
import { detailView } from "./homePanels.ts";
import { BADGE_KEYS, PLATE_PAD, purchasePicture, SHOP_ART } from "./itemArt.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { closeOverlay, listenDismiss, openOverlay, type OverlayData } from "./overlay.ts";
import {
  currentSettings,
  profileSave,
  purchaseInProfile,
  takeCelebrations,
} from "./profileStore.ts";
import { purchaseConfirmView } from "./purchaseConfirmView.ts";
import {
  addHtmlDetailCard,
  addHtmlPurchaseConfirm,
  followScene,
  htmlPanelInput,
  htmlPanelPlace,
  keepPanel,
  type KeptPanel,
} from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { LIST_SCROLL_RULE } from "./scrollView.ts";
import { selectionOrbitSegments } from "./selectionOrbit.ts";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress.ts";
import { selectOuter } from "./uiKit.ts";

// The caller pauses itself and launches the shop, on the tab of focus and framing its row
// when given, else on the Dogs tab; the shop resumes it on close.
export interface ShopSceneData extends OverlayData {
  focus?: Purchase;
}

// Emitted on game.events after each purchase, so the screen under the shop redraws its bank.
export const SHOP_CHANGED_EVENT = "shop-changed";
// Emitted on game.events when the shop closes, with the last purchase or refusal, so the
// home screen can greet a bought dog.
export const SHOP_CLOSED_EVENT = "shop-closed";

export interface ShopClosed {
  readonly action: HomeAction;
}

// While a detail card is open, a press anywhere on the shop's panel is dismiss: its tap closes
// the card. While the purchase confirm is open, so is a press on the panel off the confirm's
// card: its tap cancels, as the confirm's own close control's does.
type Target =
  | { choice: ConfirmChoice; kind: "confirm" }
  | { kind: "dismiss" }
  | { id: string; kind: "row" }
  | { kind: "tab"; tab: ShopTab };

const LAYOUT = SHOP_LAYOUT;
const PANEL: Rect = LAYOUT.panel;
const TAB_RECTS: readonly Rect[] = shopTabRects(SHOP_TABS.length);
const ROW = LAYOUT.row;
const OWNED_DX = ROW.ownedDx;
const LIST: Rect = LAYOUT.list.rect;
const PLATE: Rect = LAYOUT.message.plate;

// A purchase's art on its row: a dog's face, a gear item's icon, the slot's art.
function purchaseArt(purchase: Purchase): string {
  switch (purchase.kind) {
    case "dog":
      return dogFaceKey(gameData, purchase.dog);
    case "dogSlot":
      return SHOP_ART.dogSlot;
    case "gear":
      return gearIconKey(purchase.gear);
    default:
      return purchase satisfies never;
  }
}

// A row as laid out on the open tab.
interface PlacedRow {
  readonly rect: Rect;
  readonly row: ShopRow;
}

// Text is measured once into the same rows used by native painting, scrolling and contacts.
function shopTextLayout(
  fonts: Readonly<Record<"body" | "title", BitmapFont>>,
  measure: Pick<PanelMeasure, "body">,
  subject: { readonly message: string | null; readonly save: SaveDocument; readonly tab: ShopTab },
) {
  const widthOf = (text: string) => advanceWidth(fonts.body, TEXT_SCALE, shownText("body", text));
  const lines =
    subject.message === null ? [] : wrapWords(widthOf, SHOP_MESSAGE_FIT.room, subject.message);
  const message = shopMessageLayout(measure.body, Math.max(1, lines.length));
  const build = (frame: ReturnType<typeof shopListFrame>) => {
    const headings: { readonly note: string; readonly text: string; readonly y: number }[] = [];
    const placed: (PlacedRow & { readonly lines: readonly string[] })[] = [];
    const add = (spec: Parameters<typeof rowRects>[1], rows: readonly ShopRow[]) => {
      const described = rows.map((row) => {
        const right =
          row.price === null
            ? OWNED_DX +
              advanceWidth(fonts.title, TEXT_SCALE, gameData.homeText.shop.owned.toUpperCase())
            : widthOf(dollarText(row.price)) + 2 * PLATE_PAD;
        const room = shopRowTextRoom(frame.rowWidth, right);
        return row.line === "" ? [] : wrapWords(widthOf, room, row.line);
      });
      const rects = rowRects(
        frame.rowWidth,
        spec,
        described.map((lines) => shopRowHeight(measure.body, spec.height, lines.length)),
      );
      rows.forEach((row, index) =>
        placed.push({ lines: described[index]!, rect: rects[index]!, row }),
      );
      return rects;
    };
    const words = gameData.homeText.shop;
    const shift = message.extraHeight;
    let bottom: number;
    if (subject.tab === "gear") {
      const spec = { ...LAYOUT.gear.rows, y: LAYOUT.gear.rows.y + shift };
      headings.push({
        note: ownedCountNote(gameData, subject.save.owned, "gear"),
        text: words.tabs.gear,
        y: LAYOUT.gear.headingY + shift,
      });
      bottom = shopRowsBottom(spec, add(spec, gearRows(gameData, subject.save.owned)));
    } else {
      const slots = { ...LAYOUT.dogs.slotRows, y: LAYOUT.dogs.slotRows.y + shift };
      headings.push({
        note: ownedCountNote(gameData, subject.save.owned, "slots"),
        text: words.slots,
        y: LAYOUT.dogs.slotHeadingY + shift,
      });
      const slotRects = add(slots, slotRows(gameData, subject.save.owned));
      const heading = shopNextHeading(slots, slotRects);
      headings.push({
        note: ownedCountNote(gameData, subject.save.owned, "dogs"),
        text: words.dogs,
        y: heading,
      });
      const dogs = {
        ...LAYOUT.dogs.dogRows,
        y: heading + LAYOUT.dogs.dogRows.y - LAYOUT.dogs.dogHeadingY,
      };
      bottom = shopRowsBottom(dogs, add(dogs, dogRows(gameData, subject.save.owned)));
    }
    return { bottom: bottom + LAYOUT.list.padBottom, frame, headings, rows: placed };
  };
  const natural = build(shopListFrame(false));
  const layout =
    scrollMax(natural.frame.rect, natural.bottom) > 0 ? build(shopListFrame(true)) : natural;
  return { ...layout, message: { ...message, lines } };
}

// The Pet shop under the home screen's top bar: a Dogs tab of dog slots and dogs, and a Gear
// tab of gear for sale. Tapping a row the bank covers asks to confirm the purchase, and only
// the confirm's Buy buys it; a row it cannot pays a shake and says why. The row the shop
// opened on, or the last one tapped, is framed.
// Holding a dog or gear row opens its detail card. A tab's headings and rows scroll in the list
// area under the tabs, by a drag, the wheel or the page keys, with a scrollbar beside a list
// longer than the view; a drag taps nothing. Left and right switch tabs, up and down move the
// frame and bring its row into view, Enter or Space taps the framed row, and Escape cancels the
// confirm, or closes the card or the shop. On the confirm, Enter or Space buys, and a tap on
// the dim around its card cancels.
export class ShopScene extends Scene {
  private action: HomeAction = { kind: "none" };
  // The purchase asked for and not yet answered, and where its answers were drawn.
  private confirm: PendingPurchase | undefined;
  private detail: Purchase | undefined;
  // The detail card and the purchase confirm drawn in HTML, while each is open.
  private htmlConfirm: KeptPanel | undefined;
  private htmlDetail: KeptPanel | undefined;
  private focusId: string | null = null;
  // The open list's area, rows' width and heading note's right edge, by whether it scrolls.
  private frame = shopListFrame(false);
  private hold: HoldPress | undefined;
  // The persistent native page, mounted after the shared UI readiness barrier.
  private native: NativeShopScreen | undefined;
  private nativeDragging = false;
  // The last tap's message, on its plate over the list's top: a purchase in green, a refusal
  // in dark red.
  private message: { readonly refused: boolean; readonly text: string } | null = null;
  private placed: PlacedRow[] = [];
  private messagePlate: Rect = PLATE;
  private pressed: Target | undefined;
  private presses: TargetPressListener | undefined;
  private resumeKey: SceneKey | undefined;
  // The open tab's scroll and fling state.
  private scroll: ListScroll = listScroll(0);
  private shakes = new Map<string, number>();
  private tab: ShopTab = shopOpenTab(undefined);

  constructor() {
    super(SCENE_KEYS.shop);
  }

  create(data: ShopSceneData): void {
    this.resumeKey = data.resume;
    this.action = { kind: "none" };
    this.confirm = undefined;
    this.detail = undefined;
    this.hold = undefined;
    // The scene's shutdown destroyed any HTML card.
    this.htmlConfirm = undefined;
    this.htmlDetail = undefined;
    this.message = null;
    this.pressed = undefined;
    this.scroll = listScroll(0);
    this.shakes = new Map();
    this.tab = shopOpenTab(data.focus);
    this.focusId = data.focus === undefined ? null : shopRowId(data.focus);
    // Mount only after fonts and the shared native layer are ready.
    this.native = undefined;
    const layer = uiLayer();
    if (layer === undefined || (layer.ready() && htmlPanelPlace(this) === undefined)) {
      this.close();
      return;
    }
    const stopReady = layer.onReady(() => {
      if (this.native === undefined) {
        this.render();
        this.showFocus();
      }
    });
    this.events.once("shutdown", () => {
      stopReady?.();
      this.native?.destroy();
      this.native = undefined;
    });
    this.render();
    this.showFocus();

    // A tap acts once its dip ends, but a row's tap that opens the confirm acts as it lifts;
    // holding a dog or gear row opens its detail card, and the hold takes the press. With a card
    // open, a tap anywhere closes it, as on the Logbook.
    this.presses = listenTargetPress<Target>(this, {
      dipMs: (target) => (target.kind === "dismiss" ? 0 : FEEDBACK.pressDipMs),
      onPressed: (target) => {
        this.pressed = target?.kind === "dismiss" ? undefined : target;
        if (target === undefined) {
          this.hold = undefined;
        }
        this.render();
      },
      onTap: (target) => this.act(target),
      opens: (target) => this.opensConfirm(target),
      same: sameByValue,
      targetAt: () => undefined,
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.native?.accepts() === true && menuKeyActs(event.repeat, event.code)) {
        this.onKey(event.code);
      }
    });
    // The shop is a page, not a modal: its live top bar keeps its buttons, and a tap on the bar's
    // empty area or beside the game closes the shop, as Back does; the page itself has no outside.
    // An open card or confirm is modal, and its own backdrop takes those taps instead. The system
    // back cancels the confirm or closes an open card first, as Escape does.
    listenDismiss(
      this,
      sceneRegionOutside(this, [PANEL]),
      () => this.back(),
      () => this.back(),
    );
    // A page the top bar opens over the shop closes an open card or confirm first.
    listenHomeBar(this, () => {
      if (this.confirm !== undefined || this.detail !== undefined) {
        this.back();
      }
    });
  }

  private startRowHold(point: Point, target: Target | undefined): void {
    const layer = uiLayer();
    if (layer !== undefined) {
      // Native tap bursts share the panel renderer rather than drawing behind opaque UI.
      addNativeTapBurst(layer, point);
    }
    if (!this.isListOpen()) {
      return;
    }
    const purchase = target?.kind === "row" ? this.rowById(target.id)?.purchase : undefined;
    this.hold =
      purchase !== undefined && purchase.kind !== "dogSlot"
        ? startHold(holdRule(gameData.tuning, TILE_SLOP_PX), point, this.time.now)
        : undefined;
  }

  private nativeDown(point: Point): void {
    const target = containsPoint(PANEL, point.x, point.y)
      ? this.targetAt(point.x, point.y)
      : { kind: "dismiss" as const };
    this.presses?.down(target);
    this.startRowHold(point, target);
    if (this.isListOpen() && containsPoint(LIST, point.x, point.y)) {
      this.scroll = pressScroll(point.y, this.time.now, this.scroll);
    }
  }

  private nativeMove(point: Point): void {
    if (this.hold !== undefined) {
      this.hold = moveHold(point, this.hold);
    }
    const was = isDragging(this.scroll);
    this.scroll = dragScroll(LIST_SCROLL_RULE, point.y, this.time.now, this.scroll);
    if (isDragging(this.scroll)) {
      this.nativeDragging = true;
      if (!was) {
        this.presses?.cancel();
        this.hold = undefined;
        this.pressed = undefined;
      }
      this.placeList();
    }
  }

  private nativeUp(point: Point, cancelled: boolean): void {
    this.presses?.up(
      containsPoint(PANEL, point.x, point.y)
        ? this.targetAt(point.x, point.y)
        : { kind: "dismiss" },
      cancelled || this.nativeDragging,
    );
    this.nativeDragging = false;
    this.scroll = releaseScroll(
      LIST_SCROLL_RULE,
      currentSettings(this).reducedMotion,
      this.time.now,
      this.scroll,
    );
  }

  private cancelNativePress(): void {
    this.presses?.cancel();
    this.hold = undefined;
    this.pressed = undefined;
    this.nativeDragging = false;
    this.scroll = releaseScroll(LIST_SCROLL_RULE, true, this.time.now, this.scroll);
  }

  private placeNative(): void {
    const reduced = currentSettings(this).reducedMotion;
    this.native?.place({
      ...(this.pressed?.kind === "row" ? { pressed: this.pressed.id } : {}),
      rows: new Map(
        this.placed.map(({ rect, row }) => {
          const focused = this.focusId === row.id ? shopFocusView(rect) : undefined;
          return [
            row.id,
            {
              frame: focused?.fills ?? [],
              orbit:
                focused === undefined || reduced
                  ? []
                  : selectionOrbitSegments(focused.outer, "shop", this.time.now).map(
                      ({ colour, rect }) => ({ colour: PALETTE[colour], rect }),
                    ),
              x: shakeOffset(reduced, this.time.now, this.shakes.get(row.id)),
            },
          ];
        }),
      ),
      scroll: {
        max: this.scroll.max,
        settled: this.scroll.drag === null && this.scroll.velocity === 0,
        y: this.scroll.y,
      },
      scrollbar: shopScrollbar(this.scroll.max, this.scroll.y),
    });
  }

  private renderNative(place: NonNullable<ReturnType<typeof htmlPanelPlace>>): void {
    const save = this.save();
    const measure = canvasPanelMeasure(this);
    const { fonts, layer } = place;
    const layout = shopTextLayout(fonts, measure, {
      message: this.message?.text ?? null,
      save,
      tab: this.tab,
    });
    this.scroll = resizeScroll(scrollMax(layout.frame.rect, layout.bottom), this.scroll);
    this.frame = layout.frame;
    this.messagePlate = layout.message.plate;
    const line = (
      text: string,
      x: number,
      capTop: number,
      colour: number,
      font: "body" | "title" = "body",
    ): PanelText => ({
      capTop,
      centre: "left",
      centreX: x,
      colour,
      font,
      line: 0,
      scale: TEXT_SCALE,
      text,
    });
    const headings: PanelText[] = [];
    const rows: ShopScreenRow[] = [];
    this.placed = layout.rows;
    const heading = (y: number, text: string, note: string) => {
      headings.push(
        line(text, LAYOUT.headingX, y, PALETTE.darkBrown, "title"),
        line(
          note,
          this.frame.headingRight - advanceWidth(fonts.body, TEXT_SCALE, note),
          y,
          PALETTE.darkBrown,
        ),
      );
    };
    layout.headings.forEach(({ note, text, y }) => heading(y, text, note));
    for (const { lines: descriptions, rect, row } of layout.rows) {
      const look = SHOP_ROW_VIEWS[shopRowLook(gameData, save.owned, save.bankCents, row)];
      const mid = rect.y + Math.floor(rect.height / 2);
      const right = rect.x + rect.width - ROW.plateInset;
      const box = {
        height: ROW.box.size,
        width: ROW.box.size,
        x: rect.x + ROW.box.dx,
        y: rect.y + Math.floor((rect.height - ROW.box.size) / 2),
      };
      const key = purchaseArt(row.purchase);
      const frame = this.textures.getFrame(key);
      const tops = shopRowTextTops(measure.body, descriptions.length);
      const texts = [
        line(
          row.name,
          rect.x + ROW.textDx,
          row.line === "" ? mid - 5 : mid + tops.name,
          PALETTE[selectLook(look.state).text],
        ),
      ];
      descriptions.forEach((description, index) => {
        texts.push(
          line(
            description,
            rect.x + ROW.textDx,
            mid + tops.line + index * measure.body.lineHeight * TEXT_SCALE,
            look.state === "disabled" ? PALETTE[GREYED.text] : PALETTE.darkBrown,
          ),
        );
      });
      const art: ShopScreenRow["art"][number][] = [
        {
          key,
          rect: {
            height: frame.height,
            width: frame.width,
            x: box.x + ROW.art,
            y: box.y + ROW.art,
          },
          sheet: row.purchase.kind === "dog",
          ...(look.art === "grey" ? { imageKey: disabledArtKey(key) } : {}),
          tag: "happy",
        },
      ];
      if (look.badge !== null) {
        art.push({
          key: BADGE_KEYS[look.badge],
          rect: {
            height: this.textures.getFrame(BADGE_KEYS[look.badge]).height,
            width: this.textures.getFrame(BADGE_KEYS[look.badge]).width,
            x: rect.x + ROW.badge.dx,
            y: rect.y + ROW.badge.dy,
          },
          sheet: false,
        });
      }
      let plate: ShopScreenRow["plate"];
      if (row.price === null || look.plate === null) {
        const owned = gameData.homeText.shop.owned;
        texts.push(
          line(
            owned,
            right - OWNED_DX - advanceWidth(fonts.title, TEXT_SCALE, owned.toUpperCase()),
            mid - 4,
            PALETTE.forest,
            "title",
          ),
        );
        art.push({
          key: "ui-check",
          rect: { height: 16, width: 16, x: right - 16, y: mid - 8 },
          sheet: true,
          tag: "tick",
        });
      } else {
        plate = pricePlateView(
          {
            capHeight: measure.body.capHeight,
            padding: PLATE_PAD,
            scale: TEXT_SCALE,
            width: (value) => advanceWidth(fonts.body, TEXT_SCALE, value),
          },
          { capTop: mid - 5, originX: 1, x: right },
          look.plate,
          dollarText(row.price),
        );
      }
      rows.push({
        art,
        fills: [{ colour: PALETTE[pictureBox(look)], rect: box }],
        frame: this.textures.exists("ui-tile") ? "art" : "fallback",
        holdDetail: row.purchase.kind !== "dogSlot",
        id: row.id,
        label: row.name,
        rect,
        state: look.state,
        texts,
        ...(plate === undefined ? {} : { plate }),
      });
    }
    const words = gameData.homeText.shop;
    const view: ShopScreenView = {
      clip: this.frame.rect,
      headings,
      page: shopPageView(measure, {
        tabs: SHOP_TABS.map((tab) => ({
          label: words.tabs[tab],
          open: tab === this.tab,
          pressed: sameByValue({ kind: "tab", tab }, this.pressed),
        })),
        title: words.title,
      }),
      rows,
      ...(this.message === null
        ? {}
        : {
            message: {
              lines: layout.message.lines.map((text, index) => ({
                ...line(
                  text,
                  layout.message.plate.x + layout.message.plate.width / 2,
                  layout.message.capTops[index]!,
                  this.message!.refused ? PALETTE.darkRed : PALETTE.forest,
                ),
                centre: "ink",
              })),
              rect: layout.message.plate,
            },
          }),
    };
    if (this.native === undefined) {
      const panelInput = htmlPanelInput(place);
      this.native = followScene(
        this,
        showShopScreen(
          layer,
          {
            active: () => this.sys.isActive() && this.isListOpen(),
            cancel: () => this.cancelNativePress(),
            click: (point) => {
              const target = this.targetAt(point.x, point.y);
              if (target !== undefined) {
                this.actAfterDip(target);
              }
            },
            close: () => this.close(),
            down: (point) => this.nativeDown(point),
            fonts,
            key: (code, repeat) => {
              if (menuKeyActs(repeat, code)) {
                this.onKey(code);
              }
            },
            move: (point) => this.nativeMove(point),
            source: {
              artUrl: domArtUrl,
              imageSize: (key: string) => {
                const frame = this.textures.getFrame(key);
                return { height: frame?.realHeight ?? 16, width: frame?.realWidth ?? 16 };
              },
              loadSheet,
            },
            toGame: panelInput.toGame,
            up: (point, cancelled) => this.nativeUp(point, cancelled),
            wheel: (delta) => {
              this.scroll = wheelScroll(LIST_SCROLL_RULE, delta, this.scroll);
              this.placeList();
            },
          },
          view,
        ),
      );
    } else {
      this.native.update(view);
    }
    this.placeNative();
    if (this.detail === undefined) {
      this.htmlDetail?.panel?.destroy();
      this.htmlDetail = undefined;
    } else {
      this.drawDetail(save, this.detail);
    }
    if (this.confirm === undefined) {
      this.htmlConfirm?.panel?.destroy();
      this.htmlConfirm = undefined;
    } else {
      this.drawConfirm(this.confirm);
    }
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  // Nothing covers the list: no detail card or confirm is open.
  private isListOpen(): boolean {
    return this.detail === undefined && this.confirm === undefined;
  }

  private moveList(scroll: ListScroll): void {
    this.scroll = scroll;
    this.placeList();
  }

  // The list at its scroll, and the scrollbar's thumb beside it.
  private placeList(): void {
    this.placeNative();
  }

  // The framed row, with its frame, brought into view.
  private showFocus(): void {
    const focused = this.placed.find(({ row }) => row.id === this.focusId);
    if (focused !== undefined) {
      this.moveList(scrollToShow(LIST, selectOuter(focused.rect), this.scroll));
    }
  }

  // An open confirm cancels, else an open card closes, else the shop.
  private back(): void {
    if (this.confirm !== undefined) {
      this.answer("cancel");
      return;
    }
    if (this.detail === undefined) {
      this.close();
      return;
    }
    this.detail = undefined;
    this.render();
  }

  private onKey(code: string): void {
    if (this.confirm !== undefined) {
      this.onKeyAnswer(code);
      return;
    }
    if (isPauseKey(code) || (this.detail !== undefined && isConfirmKey(code))) {
      this.back();
      return;
    }
    if (this.detail !== undefined) {
      return;
    }
    const direction = focusDirectionForKey(code);
    if (direction === "left" || direction === "right") {
      const index = SHOP_TABS.indexOf(this.tab) + (direction === "left" ? -1 : 1);
      const tab = SHOP_TABS[clampIndex(SHOP_TABS.length, index)];
      if (tab !== undefined && tab !== this.tab) {
        this.actAfterDip({ kind: "tab", tab });
      }
      return;
    }
    if (direction === "up" || direction === "down") {
      const ids = this.rows().map(({ id }) => id);
      const at = this.focusId === null ? -1 : ids.indexOf(this.focusId);
      const next = clampIndex(ids.length, at + (direction === "up" ? -1 : 1));
      this.focusId = ids[next] ?? this.focusId;
      this.message = null;
      this.render();
      this.showFocus();
      return;
    }
    const paged = pageKeyScroll(LIST.height - LAYOUT.list.pageOverlap, code, this.scroll);
    if (paged !== undefined) {
      this.moveList(paged);
      return;
    }
    if (isConfirmKey(code) && this.focusId !== null) {
      this.actAfterDip({ id: this.focusId, kind: "row" });
    }
  }

  // Escape or P cancels at once; Enter or Space presses Buy, which dips, then buys.
  private onKeyAnswer(code: string): void {
    const choice = keyAnswer(code);
    if (choice === "cancel") {
      this.answer(choice);
    } else if (choice === "buy") {
      this.actAfterDip({ choice, kind: "confirm" });
    }
  }

  // A key presses the tab or row: it dips, then acts, as a tap does, and a row that opens the
  // confirm opens it at once, its dip playing on under it.
  private actAfterDip(target: Target): void {
    this.pressed = target;
    this.render();
    const opens = this.opensConfirm(target);
    if (opens) {
      this.act(target);
    }
    this.time.delayedCall(FEEDBACK.pressDipMs, () => {
      this.pressed = undefined;
      this.render();
      if (!opens) {
        this.act(target);
      }
    });
  }

  // Whether a tap on target opens the purchase confirm: a row not owned that the bank covers.
  private opensConfirm(target: Target): boolean {
    const row = target.kind === "row" ? this.rowById(target.id) : undefined;
    if (row === undefined) {
      return false;
    }
    const save = this.save();
    return (
      shopRowLook(gameData, save.owned, save.bankCents, row) !== "owned" &&
      requestPurchase(gameData, save, row.name, row.purchase).kind === "confirm"
    );
  }

  private close(): void {
    const closed: ShopClosed = { action: this.action };
    this.game.events.emit(SHOP_CLOSED_EVENT, closed);
    closeOverlay(this.resumeKey, this);
  }

  // The rows of the open tab, top to bottom.
  private rows(): ShopRow[] {
    const { owned } = this.save();
    return this.tab === "gear"
      ? gearRows(gameData, owned)
      : [...slotRows(gameData, owned), ...dogRows(gameData, owned)];
  }

  private targetAt(x: number, y: number): Target | undefined {
    const tab = TAB_RECTS.findIndex((rect) => containsPoint(rect, x, y));
    const tabId = SHOP_TABS[tab];
    if (tabId !== undefined) {
      return { kind: "tab", tab: tabId };
    }
    // The message's plate lies over the rows; only the list area's part of a row is pressed.
    if (this.message !== null && containsPoint(this.messagePlate, x, y)) {
      return undefined;
    }
    if (!containsPoint(this.frame.rect, x, y)) {
      return undefined;
    }
    const listY = y + this.scroll.y;
    const hit = this.placed.find(({ rect }) => containsPoint(rect, x, listY));
    return hit === undefined ? undefined : { id: hit.row.id, kind: "row" };
  }

  private rowById(id: string): ShopRow | undefined {
    return this.rows().find((row) => row.id === id);
  }

  private pressedPurchase(): Purchase | undefined {
    const pressed = this.pressed;
    return pressed?.kind === "row" ? this.rowById(pressed.id)?.purchase : undefined;
  }

  private openDetail(): void {
    const purchase = this.pressedPurchase();
    this.pressed = undefined;
    if (purchase !== undefined && purchase.kind !== "dogSlot") {
      this.detail = purchase;
    }
    this.render();
  }

  override update(_time: number, deltaMs: number): void {
    const flung = stepScroll(LIST_SCROLL_RULE, deltaMs, this.scroll);
    if (flung !== this.scroll) {
      this.moveList(flung);
    }
    if (this.hold !== undefined) {
      const { fire, press } = tickHold(this.time.now, this.hold);
      this.hold = press;
      if (fire) {
        this.presses?.cancel();
        this.openDetail();
      }
    }
    this.placeNative();
  }

  private act(target: Target): void {
    switch (target.kind) {
      case "confirm":
        this.answer(target.choice);
        return;
      case "dismiss":
        this.back();
        return;
      case "tab":
        if (target.tab !== this.tab) {
          this.scroll = listScroll(0);
        }
        this.tab = target.tab;
        this.message = null;
        this.render();
        return;
      case "row":
        this.tapRow(target.id);
        return;
      default:
        target satisfies never;
    }
  }

  // An owned row is only framed. One that costs more than the bank shakes and says why; one
  // the bank covers asks to confirm its purchase.
  private tapRow(id: string): void {
    const row = this.rowById(id);
    if (row === undefined) {
      return;
    }
    this.focusId = id;
    const save = this.save();
    const look = shopRowLook(gameData, save.owned, save.bankCents, row);
    const text = gameData.homeText;
    if (look === "owned") {
      this.message = null;
    } else {
      const request = requestPurchase(gameData, save, row.name, row.purchase);
      if (request.kind === "confirm") {
        this.message = null;
        this.confirm = request.pending;
      } else if (request.reason === "cantAfford" && row.price !== null) {
        this.shakes.set(id, this.time.now);
        this.action = {
          amount: cents(row.price - save.bankCents),
          kind: "cantAfford",
          name: row.name,
        };
        this.message = { refused: true, text: messageLine(text, this.action) ?? "" };
      }
    }
    this.render();
  }

  // The confirm closes; its Buy buys the pending purchase, if the bank still covers it.
  private answer(choice: ConfirmChoice): void {
    const confirm = this.confirm;
    if (confirm === undefined) {
      return;
    }
    this.confirm = undefined;
    const result = answerPurchase(gameData, this.save(), confirm, choice);
    if (result.kind === "bought") {
      this.bought(confirm, result.save);
      return;
    }
    this.render();
  }

  private bought(pending: PendingPurchase, save: SaveDocument): void {
    void purchaseInProfile(this, () => save);
    this.action = { kind: "bought", name: pending.name, purchase: pending.purchase };
    this.message = { refused: false, text: messageLine(gameData.homeText, this.action) ?? "" };
    this.game.events.emit(SHOP_CHANGED_EVENT);
    this.render();
    this.celebrate(pending.purchase);
  }

  // Badges a purchase earned burst in over the shop, the bought dog's owner cheering.
  private celebrate(purchase: Purchase): void {
    const achievements = takeCelebrations(this);
    if (achievements.length === 0) {
      return;
    }
    const data: CelebrationSceneData = {
      achievements,
      owners: purchase.kind === "dog" ? [purchase.dog] : [],
      resume: SCENE_KEYS.shop,
    };
    openOverlay(this, SCENE_KEYS.celebration, data);
  }

  private render(): void {
    const place = htmlPanelPlace(this);
    if (place !== undefined) {
      this.renderNative(place);
    }
  }

  private drawConfirm(pending: PendingPurchase): void {
    const pressed = this.pressed?.kind === "confirm" ? this.pressed.choice : undefined;
    const view = purchaseConfirmView(this, {
      lines: confirmLines(gameData, pending),
      picture: purchasePicture(pending.purchase),
      pressed,
    });
    this.htmlConfirm = keepPanel(this.htmlConfirm, JSON.stringify(view), () =>
      addHtmlPurchaseConfirm(this, view, (choice) => this.answer(choice)),
    );
  }

  // A held dog's or gear item's detail card over the shop; any tap closes it.
  private drawDetail(save: SaveDocument, purchase: Purchase): void {
    if (purchase.kind === "dogSlot") {
      return;
    }
    const card =
      purchase.kind === "dog"
        ? dogDetail(gameData, save.owned, save.bankCents, purchase.dog)
        : gearDetail(gameData, save.owned, save.bankCents, save.lastLoadout, purchase.gear);
    const dim = overlayRegion("home");
    const view = detailView(this, dim, {
      card,
      kind: purchase.kind,
      picture: purchasePicture(purchase),
    });
    this.htmlDetail = keepPanel(this.htmlDetail, JSON.stringify(view), () =>
      addHtmlDetailCard(this, view, undefined, false, () => this.back()),
    );
  }
}
