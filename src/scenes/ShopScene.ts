import { clampIndex } from "@andornaut/game-kit/runtime/arrays";
import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { containsPoint, insetRect, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { advanceWidth, type BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { Scene } from "phaser";

import { domArtUrl } from "../assets/domArtFiles.ts";
import { dogFaceKey, gearIconKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { PLATE_PAD } from "../data/layout.ts";
import { FEEDBACK, shakeOffset } from "../home/feedback.ts";
import type { Purchase } from "../home/home.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { type HomeAction, messageLine } from "../home/homeLines.ts";
import { itemModal } from "../home/itemModal.ts";
import { pricePlateView } from "../home/pricePlateView.ts";
import {
  answerPurchase,
  type ConfirmChoice,
  type PendingPurchase,
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
import {
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopHeadingBand,
  shopListFrame,
  shopMessageLayout,
  shopNextHeading,
  shopRowsBottom,
  shopRowTextLayout,
  shopRowTextRoom,
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
  focusDirectionForKey,
  isConfirmKey,
  isPauseKey,
  menuKeyActs,
} from "../input/keyBindings.ts";
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
import { stackRows } from "../ui/pageLayout.ts";
import { PALETTE } from "../ui/palette.ts";
import { refusalRed } from "../ui/refuse.ts";
import { GREYED, pictureBox, selectLook } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import type { CelebrationSceneData } from "./CelebrationScene.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import { detailView } from "./homePanels.ts";
import { BADGE_KEYS, purchasePicture, SHOP_ART } from "./itemArt.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { closeOverlay, onBackPressed, openOverlay, type OverlayData } from "./overlay.ts";
import {
  currentSettings,
  profileSave,
  purchaseInProfile,
  takeCelebrations,
} from "./profileStore.ts";
import {
  addHtmlDetailCard,
  followScene,
  htmlPanelInput,
  htmlPanelPlace,
  keepPanel,
  type KeptPanel,
} from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { LIST_SCROLL_RULE } from "./scrollView.ts";
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
// the card. An item modal owns its dismissal and purchase actions.
type Target = { id: string; kind: "row" } | { kind: "tab"; tab: ShopTab };

const LAYOUT = SHOP_LAYOUT;
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
    const placed: (PlacedRow & {
      readonly lines: readonly string[];
      readonly text: ReturnType<typeof shopRowTextLayout>;
    })[] = [];
    const add = (
      spec: { readonly gap: number; readonly height: number; readonly y: number },
      rows: readonly ShopRow[],
    ) => {
      const described = rows.map((row) => {
        const right =
          row.price === null
            ? OWNED_DX +
              advanceWidth(fonts.title, TEXT_SCALE, gameData.homeText.shop.owned.toUpperCase())
            : widthOf(dollarText(row.price)) + 2 * PLATE_PAD;
        const room = shopRowTextRoom(frame.rowWidth, right);
        const lines = row.line === "" ? [] : wrapWords(widthOf, room, row.line);
        return {
          lines,
          text: shopRowTextLayout(fonts.body, spec.height, { descriptions: lines, name: row.name }),
        };
      });
      const rects = stackRows(
        { ...spec, width: frame.rowWidth, x: SHOP_LAYOUT.row.x },
        described.map(({ text }) => text.height),
      );
      rows.forEach((row, index) => placed.push({ ...described[index]!, rect: rects[index]!, row }));
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
  const layout = build(shopListFrame());
  return { ...layout, message: { ...message, lines } };
}

// The Pet shop under the home screen's top bar: a Dogs tab of dog slots and dogs, and a Gear
// tab of gear for sale. Tapping an affordable row opens its item modal, whose Buy purchases it;
// an unaffordable row shakes and says why. The row the shop
// opened on, or the last one tapped, is framed.
// Holding any item opens the same detail modal. A tab's headings and rows scroll in the list
// area under the tabs, by a drag, the wheel or the page keys, with a scrollbar beside a list
// longer than the view; a drag taps nothing. Left and right switch tabs, up and down move the
// frame and bring its row into view, Enter or Space taps the framed row, and Escape closes the
// item modal or the shop. Native modal buttons own their keyboard activation.
export class ShopScene extends Scene {
  private action: HomeAction = { kind: "none" };
  // The item shown in the shared detail/purchase modal.
  private detail: Purchase | undefined;
  // The item's native detail/purchase modal.
  private htmlDetail: KeptPanel | undefined;
  private focusId: string | null = null;
  // The open list's area, rows' width and heading note's right edge, by whether it scrolls.
  private frame = shopListFrame();
  // The persistent native page, mounted after the shared UI readiness barrier.
  private native: NativeShopScreen | undefined;
  private nativeDragging = false;
  // The last tap's message, on its plate over the list's top: a purchase in green, a refusal
  // in dark red.
  private message: { readonly refused: boolean; readonly text: string } | null = null;
  private placed: PlacedRow[] = [];
  private messagePlate: Rect = PLATE;
  private pressed: Target | undefined;
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
    this.detail = undefined;
    // The scene's shutdown destroyed any HTML card.
    this.htmlDetail = undefined;
    this.message = null;
    this.pressed = undefined;
    this.scroll = listScroll(0);
    this.shakes = new Map();
    this.tab = shopOpenTab(data.focus);
    this.focusId = null;
    if (data.focus !== undefined) {
      const row = this.rowById(shopRowId(data.focus));
      if (row !== undefined && this.rowLook(this.save(), row) !== "short") {
        this.focusId = row.id;
      }
    }
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

    // A tap acts once its dip ends, but an affordable row opens its item modal as it lifts;
    // holding a dog or gear row opens its detail card, and the hold takes the press. With a card
    // open, a tap anywhere closes it, as on the Logbook.
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.native?.accepts() === true && menuKeyActs(event.repeat, event.code)) {
        this.onKey(event.code);
      }
    });
    // The shop is a page, not a modal: its live top bar keeps its buttons, and it has no outside,
    // so a tap on the bar's empty area or beside the game does nothing. An item modal's backdrop
    // closes the item. System back closes the item first, then the shop, as Escape does.
    onBackPressed(this, () => this.back());
    // A page the top bar opens over the shop closes an open item modal first.
    listenHomeBar(this, () => {
      if (this.detail !== undefined) {
        this.back();
      }
    });
  }

  private nativeDown(point: Point): void {
    const layer = uiLayer();
    if (layer !== undefined) {
      addNativeTapBurst(layer, point);
    }
    if (this.isListOpen() && containsPoint(LIST, point.x, point.y)) {
      this.scroll = pressScroll(point.y, this.time.now, this.scroll);
    }
  }

  private nativeMove(point: Point): void {
    const was = isDragging(this.scroll);
    this.scroll = dragScroll(LIST_SCROLL_RULE, point.y, this.time.now, this.scroll);
    if (isDragging(this.scroll)) {
      this.nativeDragging = true;
      if (!was) {
        this.pressed = undefined;
      }
      this.placeList();
    }
  }

  private nativeUp(_point: Point, cancelled: boolean): boolean {
    const handled = cancelled || this.nativeDragging;
    this.nativeDragging = false;
    this.scroll = releaseScroll(
      LIST_SCROLL_RULE,
      currentSettings(this).reducedMotion,
      this.time.now,
      this.scroll,
    );
    return handled;
  }

  private cancelNativePress(): void {
    this.pressed = undefined;
    this.nativeDragging = false;
    this.scroll = releaseScroll(LIST_SCROLL_RULE, true, this.time.now, this.scroll);
  }

  private placeNative(): void {
    const reduced = currentSettings(this).reducedMotion;
    const refused = (id: string) => {
      const at = this.shakes.get(id);
      return at !== undefined && refusalRed(reduced, this.time.now - at);
    };
    this.native?.place({
      ...(this.pressed?.kind === "row" ? { pressed: this.pressed.id } : {}),
      rows: new Map(
        this.placed.map(({ row }) => {
          return [
            row.id,
            {
              focused: this.focusId === row.id,
              refusing: refused(row.id),
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
    const rows: ShopScreenRow[] = [];
    this.placed = layout.rows;
    for (const { lines: descriptions, rect, row, text } of layout.rows) {
      const rowLook = this.rowLook(save, row);
      const selectable = rowLook !== "short";
      if (!selectable && this.focusId === row.id) {
        this.focusId = null;
      }
      const look = SHOP_ROW_VIEWS[rowLook];
      const mid = rect.y + Math.floor(rect.height / 2);
      const right = rect.x + rect.width - ROW.plateInset;
      const box = {
        height: ROW.box.size,
        width: ROW.box.size,
        x: rect.x + ROW.box.dx,
        y: rect.y + Math.floor((rect.height - ROW.box.size) / 2),
      };
      const key = purchaseArt(row.purchase);
      const texts = [
        line(
          row.name,
          rect.x + ROW.textDx,
          rect.y + text.name,
          PALETTE[selectLook(look.state).text],
        ),
      ];
      descriptions.forEach((description, index) => {
        texts.push(
          line(
            description,
            rect.x + ROW.textDx,
            rect.y + text.descriptions[index]!,
            look.state === "disabled" ? PALETTE[GREYED.text] : PALETTE.darkBrown,
          ),
        );
      });
      const art: ShopScreenRow["art"][number][] = [
        {
          key,
          projection: "layout",
          rect: insetRect(ROW.art, box),
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
        const ownedTop = shopRowTextLayout(fonts.title, rect.height, {
          descriptions: [],
          name: shownText("title", owned),
        }).name;
        texts.push(
          line(
            owned,
            right - OWNED_DX - advanceWidth(fonts.title, TEXT_SCALE, owned.toUpperCase()),
            rect.y + ownedTop,
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
          { capTop: mid - (measure.body.capHeight * TEXT_SCALE) / 2, originX: 1, x: right },
          look.plate,
          dollarText(row.price),
        );
      }
      rows.push({
        art,
        fills: [{ colour: PALETTE[pictureBox(look)], rect: box }],
        frame: this.textures.exists("ui-tile") ? "art" : "fallback",
        holdDetail: true,
        id: row.id,
        label: row.name,
        rect,
        selectable,
        state: look.state,
        texts,
        ...(plate === undefined ? {} : { plate }),
      });
    }
    const words = gameData.homeText.shop;
    const view: ShopScreenView = {
      clip: this.frame.rect,
      headings: layout.headings.map(({ note, text, y }) => ({
        band: shopHeadingBand(y),
        note,
        title: text,
      })),
      page: shopPageView(measure, {
        tabs: SHOP_TABS.map((tab) => ({
          label: words.tabs[tab],
          open: tab === this.tab,
          pressed: this.pressed?.kind === "tab" && this.pressed.tab === tab,
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
            activateRow: (id) => this.actAfterDip({ id, kind: "row" }),
            active: () => this.sys.isActive() && this.isListOpen(),
            cancel: () => this.cancelNativePress(),
            click: (point) => {
              const target = this.targetAt(point.x, point.y);
              if (target !== undefined) {
                this.actAfterDip(target);
              }
            },
            close: () => this.close(),
            detailRow: (id) => this.openDetail(id),
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
  }

  private save(): SaveDocument {
    return profileSave(this);
  }

  // Nothing covers the list while no item modal is open.
  private isListOpen(): boolean {
    return this.detail === undefined;
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

  // Close the item modal before leaving the shop.
  private back(): void {
    if (this.detail === undefined) {
      this.close();
      return;
    }
    const id = shopRowId(this.detail);
    this.detail = undefined;
    this.render();
    this.native?.focusRow(id);
  }

  private onKey(code: string): void {
    if (isPauseKey(code)) {
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
      const save = this.save();
      const ids = this.rows()
        .filter((row) => this.rowLook(save, row) !== "short")
        .map(({ id }) => id);
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

  // A key presses the tab or row; affordable rows open their modal during the dip.
  private actAfterDip(target: Target): void {
    this.pressed = target;
    this.render();
    const opens = this.opensItem(target);
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

  // Whether a tap opens an affordable unowned item's modal.
  private opensItem(target: Target): boolean {
    const row = target.kind === "row" ? this.rowById(target.id) : undefined;
    if (row === undefined) {
      return false;
    }
    return this.rowLook(this.save(), row) === "affordable";
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

  private rowLook(save: SaveDocument, row: ShopRow): keyof typeof SHOP_ROW_VIEWS {
    return shopRowLook(gameData, save.owned, save.bankCents, row);
  }

  private rowById(id: string): ShopRow | undefined {
    return this.rows().find((row) => row.id === id);
  }

  private openDetail(id: string): void {
    const purchase = this.rowById(id)?.purchase;
    this.pressed = undefined;
    if (purchase !== undefined) {
      this.detail = purchase;
    }
    this.render();
  }

  override update(_time: number, deltaMs: number): void {
    const flung = stepScroll(LIST_SCROLL_RULE, deltaMs, this.scroll);
    if (flung !== this.scroll) {
      this.moveList(flung);
    }
    this.placeNative();
  }

  private act(target: Target): void {
    switch (target.kind) {
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
  // the bank covers opens its detail/purchase modal.
  private tapRow(id: string): void {
    const row = this.rowById(id);
    if (row === undefined) {
      return;
    }
    const save = this.save();
    const look = this.rowLook(save, row);
    if (look !== "short") {
      this.focusId = id;
    }
    const text = gameData.homeText;
    if (look === "owned") {
      this.message = null;
    } else {
      const request = itemModal(gameData, save, save.lastLoadout, row.purchase);
      if (request.pending !== undefined) {
        this.message = null;
        this.detail = row.purchase;
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

  // Buy revalidates the live item and bank before using the purchase transaction.
  private answer(choice: ConfirmChoice): void {
    const purchase = this.detail;
    if (purchase === undefined) {
      return;
    }
    const save = this.save();
    const pending = itemModal(gameData, save, save.lastLoadout, purchase).pending;
    this.detail = undefined;
    if (pending === undefined) {
      this.render();
      return;
    }
    const result = answerPurchase(gameData, save, pending, choice);
    if (result.kind === "bought") {
      this.bought(pending, result.save);
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

  // A held dog's or gear item's detail card over the shop; any tap closes it.
  private drawDetail(save: SaveDocument, purchase: Purchase): void {
    const item = itemModal(gameData, save, save.lastLoadout, purchase);
    const dim = overlayRegion("home");
    const layout = () =>
      detailView(this, dim, {
        card: item.card,
        kind: purchase.kind,
        picture: purchasePicture(purchase),
        ...(item.purchase === undefined ? {} : { purchase: item.purchase }),
        statusLines: item.statusLines,
      });
    const close = () => this.back();
    const presses = item.pending === undefined ? [] : [close, () => this.answer("buy")];
    this.htmlDetail = keepPanel(this.htmlDetail, JSON.stringify(layout()), () =>
      addHtmlDetailCard(this, layout, close, close, presses),
    );
  }
}
