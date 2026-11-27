import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { Scene } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import { dogFaceKey, gearIconKey } from "../assets/index.ts";
import { gameData } from "../data/index.ts";
import { type NativeShopScreen, showShopScreen } from "../home/dom/index.ts";
import {
  answerPurchase,
  type ConfirmChoice,
  dogRows,
  FEEDBACK,
  gearRows,
  type HomeAction,
  itemModal,
  messageLine,
  overlayRegion,
  type PendingPurchase,
  type Purchase,
  shakeOffset,
  SHOP_LAYOUT,
  SHOP_ROW_VIEWS,
  shopFocusForArrow,
  shopListFrame,
  shopOpenTab,
  type ShopPlacedRow,
  type ShopRow,
  shopRowId,
  shopRowLook,
  shopScreenView,
  type ShopTab,
  shopTabForArrow,
  type ShopTarget,
  shopTargetAt,
  slotRows,
} from "../home/index.ts";
import {
  dragScroll,
  focusDirectionForKey,
  isDragging,
  isForegroundConfirmKey,
  isPauseKey,
  type ListScroll,
  listScroll,
  menuKeyActs,
  pageKeyScroll,
  pressScroll,
  releaseScroll,
  resizeScroll,
  sceneKeyAllowed,
  scrollMax,
  scrollToShow,
  stepScroll,
  wheelScroll,
} from "../input/index.ts";
import type { SaveDocument } from "../save/index.ts";
import {
  addTapBurst as addNativeTapBurst,
  loadSheet,
  shownText,
  uiLayer,
} from "../ui/dom/index.ts";
import { refusalRed } from "../ui/index.ts";
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

const LAYOUT = SHOP_LAYOUT;
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
  private placed: ShopPlacedRow[] = [];
  private messagePlate: Rect = PLATE;
  private pressed: ShopTarget | undefined;
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
      if (!sceneKeyAllowed(event)) {
        return;
      }
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
    const { focusId, layout, view } = shopScreenView(
      {
        art: {
          badge: (badge) => {
            const key = BADGE_KEYS[badge];
            const { height, width } = this.textures.getFrame(key);
            return { height, key, width };
          },
          frame: this.textures.exists("ui-tile") ? "art" : "fallback",
          pictureKey: purchaseArt,
        },
        fonts,
        measure,
        shownText,
      },
      { focusId: this.focusId, message: this.message, pressed: this.pressed, save, tab: this.tab },
    );
    this.focusId = focusId;
    this.scroll = resizeScroll(scrollMax(layout.frame.rect, layout.bottom), this.scroll);
    this.frame = layout.frame;
    this.messagePlate = layout.message.plate;
    this.placed = layout.rows;
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
      const tab = shopTabForArrow(this.tab, direction);
      if (tab !== undefined && tab !== this.tab) {
        this.actAfterDip({ kind: "tab", tab });
      }
      return;
    }
    if (direction === "up" || direction === "down") {
      const save = this.save();
      this.focusId = shopFocusForArrow(save, this.rows(), this.focusId, direction);
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
    if (isForegroundConfirmKey(code) && this.focusId !== null) {
      this.actAfterDip({ id: this.focusId, kind: "row" });
    }
  }

  // A key presses the tab or row; affordable rows open their modal during the dip.
  private actAfterDip(target: ShopTarget): void {
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
  private opensItem(target: ShopTarget): boolean {
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

  private targetAt(x: number, y: number): ShopTarget | undefined {
    return shopTargetAt(
      {
        clip: this.frame.rect,
        messagePlate: this.message === null ? null : this.messagePlate,
        rows: this.placed,
        scrollY: this.scroll.y,
      },
      { x, y },
    );
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

  private act(target: ShopTarget): void {
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
