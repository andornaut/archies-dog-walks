import { clampIndex } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { Core, Scene } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { gameData } from "../data/index.ts";
import { type BadgeView, badgeWall } from "../home/badgesView.ts";
import { FEEDBACK } from "../home/feedback.ts";
import { focusDirectionForKey } from "../home/focus.ts";
import { overlayRegion } from "../home/homeBar.ts";
import { logbookView } from "../home/logbookView.ts";
import { STATS_LAYOUT, STATS_TABS, type StatsTab, statsTabRects } from "../home/statsLayout.ts";
import {
  type DomLogbook,
  type LogbookScroll,
  type LogbookTarget,
  showLogbook,
} from "../hud/dom/logbook.ts";
import { pillKind } from "../hud/effectNames.ts";
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
  scrollBy,
  scrollMax,
  scrollToShow,
  stepScroll,
  wheelScroll,
} from "../input/listScroll.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { badgeCard } from "./badges.ts";
import { pillColours } from "./effectNameColours.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { closeOverlay, nativeSceneAccepts, onBackPressed, type OverlayData } from "./overlay.ts";
import { currentSettings, earnedAchievements, profileSave } from "./profileStore.ts";
import {
  addHtmlBadgeCard,
  followScene,
  htmlPanelInput,
  htmlPanelPlace,
  keepPanel,
  type KeptPanel,
} from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { LIST_SCROLL_RULE } from "./scrollView.ts";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress.ts";

type Target = LogbookTarget;
const TABS = STATS_TABS;
const TAB_RECTS: readonly Rect[] = statsTabRects();
const VIEW = STATS_LAYOUT.view;
const SCROLL = STATS_LAYOUT.scroll;
const OPEN_TAB: StatsTab = "badges";

// The native Logbook shares its page model, tab geometry and scrolling rules with the shop.
export class StatsScene extends Scene {
  private burst = false;
  private detail: number | undefined;
  private htmlCard: KeptPanel | undefined;
  private page: DomLogbook | undefined;
  private pageKey = "";
  private pressed: Target | undefined;
  private presses: TargetPressListener<Target> | undefined;
  private resumeKey: SceneKey | undefined;
  private scroll: ListScroll = listScroll(0);
  private dragging = false;
  private tab: StatsTab = OPEN_TAB;
  private wallRows: readonly Rect[] = [];

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: OverlayData): void {
    this.resumeKey = data?.resume;
    this.htmlCard = undefined;
    this.page = undefined;
    this.pageKey = "";
    this.pressed = undefined;
    this.detail = undefined;
    this.dragging = false;
    this.scroll = listScroll(0);
    this.tab = OPEN_TAB;
    this.presses = listenTargetPress<Target>(this, {
      dipMs: (target) => (typeof target === "object" && "tab" in target ? FEEDBACK.pressDipMs : 0),
      onPressed: (target) => {
        this.pressed = target;
        this.render();
      },
      onTap: (target) => this.act(target),
      same: sameByValue,
      targetAt: () => undefined,
    });
    const onKey = (event: KeyboardEvent) => {
      if (!this.sys.isActive() || !this.input.enabled || !nativeSceneAccepts(this)) {
        return;
      }
      if (isConfirmKey(event.code) && (event.target as HTMLElement | null)?.tagName === "BUTTON") {
        if (event.repeat) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (this.onKey(event.code, event.repeat)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    this.events.once("shutdown", () => document.removeEventListener("keydown", onKey, true));
    // The Logbook is a page, not a modal, as the Pet shop is: its live top bar keeps its buttons,
    // and only Back, Escape and the system back leave it. An open badge card is modal, and its own
    // backdrop takes taps instead. Back closes an open card first.
    onBackPressed(this, () => this.back());
    // A page the top bar opens over the Logbook closes an open card first.
    listenHomeBar(this, () => {
      if (this.detail !== undefined) {
        this.back();
      }
    });
    mountNativeOverlay(this, () => {
      this.render();
      return this.page !== undefined;
    });
  }

  private act(target: Target): void {
    if ("tab" in target) {
      this.openTab(TABS[target.tab] ?? this.tab);
    } else {
      this.detail = target.badge;
      this.burst = true;
    }
    this.render();
  }

  private back(): void {
    if (this.detail === undefined) {
      this.close();
      return;
    }
    this.detail = undefined;
    this.render();
  }

  override update(_time: number, deltaMs: number): void {
    this.scroll = stepScroll(LIST_SCROLL_RULE, deltaMs, this.scroll);
  }

  private openTab(tab: StatsTab): void {
    if (tab !== this.tab) {
      this.scroll = listScroll(0);
    }
    this.tab = tab;
  }

  private targetAt(point: Point): Target | undefined {
    const tab = rectIndexAt(TAB_RECTS, point.x, point.y);
    if (tab !== undefined) {
      return { tab };
    }
    const onWall = this.tab === "badges" && containsPoint(VIEW, point.x, point.y);
    const badge = onWall ? rectIndexAt(this.wallRows, point.x, point.y + this.scroll.y) : undefined;
    return badge === undefined ? undefined : { badge };
  }

  private openTabAfterDip(index: number): void {
    this.pressed = { tab: index };
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => {
      this.pressed = undefined;
      this.openTab(TABS[index] ?? this.tab);
      this.render();
    });
  }

  private onKey(code: string, repeat: boolean): boolean {
    if (!menuKeyActs(repeat, code)) {
      return false;
    }
    if (isPauseKey(code) || isConfirmKey(code)) {
      this.back();
      return true;
    }
    if (this.detail !== undefined) {
      return false;
    }
    const direction = focusDirectionForKey(code);
    const paged = pageKeyScroll(VIEW.height - SCROLL.pageOverlap, code, this.scroll);
    if (paged !== undefined || direction === "up" || direction === "down") {
      this.scroll =
        paged ?? scrollBy(direction === "up" ? -SCROLL.keyStep : SCROLL.keyStep, this.scroll);
      return true;
    }
    if (direction === "left" || direction === "right") {
      const index = TABS.indexOf(this.tab);
      const next = clampIndex(TABS.length, index + (direction === "left" ? -1 : 1));
      if (next !== index) {
        this.openTabAfterDip(next);
      }
      return true;
    }
    return false;
  }

  private close(): void {
    closeOverlay(this.resumeKey, this);
  }

  private htmlScroll(): LogbookScroll {
    const { max, velocity, y } = this.scroll;
    return { max, settled: !isDragging(this.scroll) && velocity === 0, y };
  }

  private cancelPress(): void {
    this.presses?.cancel();
    this.pressed = undefined;
    this.dragging = false;
    this.scroll = releaseScroll(LIST_SCROLL_RULE, true, this.time.now, this.scroll);
  }

  private down(point: Point): void {
    this.presses?.down(this.targetAt(point));
    this.page?.burst(point);
    if (containsPoint(VIEW, point.x, point.y)) {
      this.scroll = pressScroll(point.y, this.time.now, this.scroll);
    }
  }

  private move(point: Point): void {
    const was = isDragging(this.scroll);
    this.scroll = dragScroll(LIST_SCROLL_RULE, point.y, this.time.now, this.scroll);
    if (!was && isDragging(this.scroll)) {
      this.dragging = true;
      this.presses?.cancel();
      this.pressed = undefined;
      this.render();
    }
  }

  private up(point: Point, cancelled: boolean): boolean {
    const accepted = !cancelled && !this.dragging;
    this.presses?.up(this.targetAt(point), !accepted);
    this.dragging = false;
    this.scroll = releaseScroll(
      LIST_SCROLL_RULE,
      currentSettings(this).reducedMotion,
      this.time.now,
      this.scroll,
    );
    return accepted;
  }

  private render(): void {
    const place = htmlPanelPlace(this);
    if (place === undefined) {
      return;
    }
    const badges = this.badges();
    const save = profileSave(this);
    const view = logbookView(canvasDetailMeasure(this), gameData, {
      badges,
      pressedTab:
        typeof this.pressed === "object" && "tab" in this.pressed ? this.pressed.tab : undefined,
      save,
      tab: this.tab,
    });
    this.wallRows = view.wallRows;
    this.scroll = resizeScroll(scrollMax(VIEW, view.content.bottom), this.scroll);
    const key = JSON.stringify([
      this.tab,
      view.content,
      view.frame,
      view.wallRows,
      view.page.title,
    ]);
    if (this.page === undefined || this.pageKey !== key) {
      this.page?.destroy();
      const panelInput = htmlPanelInput(place);
      const point = (event: MouseEvent) =>
        panelInput.toGame({ x: event.clientX, y: event.clientY });
      this.page = followScene(
        this,
        showLogbook(place.layer, {
          ...panelInput,
          artUrl,
          everyFrame: (step) => {
            this.game.events.on(Core.Events.PRE_RENDER, step);
            return () => this.game.events.off(Core.Events.PRE_RENDER, step);
          },
          loadSheet,
          navigation: {
            activate: (target) =>
              "tab" in target ? this.openTabAfterDip(target.tab) : this.act(target),
            close: () => this.close(),
            focus: (rect) => {
              this.scroll = scrollToShow(VIEW, rect, this.scroll);
            },
            gesture: {
              cancel: () => this.cancelPress(),
              down: (event) => this.down(point(event)),
              move: (event) => this.move(point(event)),
              up: (event, cancelled) => this.up(point(event), cancelled),
            },
            wheel: (delta) => {
              this.scroll = wheelScroll(LIST_SCROLL_RULE, delta, this.scroll);
            },
          },
          pillColours: (index) => {
            const kind = pillKind(index);
            return kind === undefined ? undefined : pillColours(kind);
          },
          scroll: () => this.htmlScroll(),
          view,
        }),
      );
      this.pageKey = key;
      this.htmlCard?.panel?.destroy();
      this.htmlCard = undefined;
    } else {
      this.page.setPage(view.page);
    }
    const open = this.detail === undefined ? undefined : badges[this.detail];
    const card =
      open === undefined
        ? undefined
        : badgeCard(this, overlayRegion("home"), {
            badge: open,
            burst: this.burst,
            reduced: currentSettings(this).reducedMotion,
          });
    this.burst = false;
    this.htmlCard = keepPanel(
      this.htmlCard,
      card === undefined ? undefined : JSON.stringify(card),
      () => (card === undefined ? undefined : addHtmlBadgeCard(this, card, () => this.back())),
    );
  }

  private badges(): BadgeView[] {
    return badgeWall(gameData, earnedAchievements(this));
  }
}
