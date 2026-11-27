import { clampIndex } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Point } from "@andornaut/game-kit/runtime/rect";
import { Core, Scene } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import { gameData } from "../data/index.ts";
import {
  type BadgeView,
  badgeWall,
  logbookView,
  overlayRegion,
  STATS_LAYOUT,
  STATS_TABS,
  type StatsTab,
} from "../home/index.ts";
import {
  type DomLogbook,
  type LogbookScroll,
  type LogbookTarget,
  showLogbook,
} from "../hud/dom/index.ts";
import {
  dragScroll,
  focusDirectionForKey,
  isConfirmKey,
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
  scrollBy,
  scrollMax,
  scrollToShow,
  stepScroll,
  wheelScroll,
} from "../input/index.ts";
import { pillKind } from "../presentation/index.ts";
import { loadSheet, shownText } from "../ui/dom/index.ts";
import { lineInk } from "../ui/index.ts";
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

type Target = LogbookTarget;
const TABS = STATS_TABS;
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
  private resumeKey: SceneKey | undefined;
  private scroll: ListScroll = listScroll(0);
  private dragging = false;
  private tab: StatsTab = OPEN_TAB;

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: OverlayData): void {
    this.resumeKey = data?.resume;
    this.htmlCard = undefined;
    this.page = undefined;
    this.pageKey = "";
    this.detail = undefined;
    this.dragging = false;
    this.scroll = listScroll(0);
    this.tab = OPEN_TAB;
    const onKey = (event: KeyboardEvent) => {
      if (!sceneKeyAllowed(event)) {
        return;
      }
      if (!this.sys.isActive() || !this.input.enabled || !nativeSceneAccepts(this)) {
        return;
      }
      if (
        isForegroundConfirmKey(event.code) &&
        (event.target as HTMLElement | null)?.tagName === "BUTTON"
      ) {
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
    document.addEventListener("keydown", onKey);
    this.events.once("shutdown", () => document.removeEventListener("keydown", onKey));
    // The Logbook is a page, not a modal, as the Pet shop is: its live top bar keeps its buttons,
    // and it has no outside, so a tap on the bar's empty area or beside the game does nothing. An
    // open badge card is modal, and its own backdrop closes it. The system back closes an open
    // card first, then the Logbook.
    onBackPressed(this, () => this.back());
    // A page the top bar opens over the Logbook closes an open card first.
    listenHomeBar(
      this,
      () => {
        if (this.detail !== undefined) {
          this.back();
        }
      },
      undefined,
      data?.resume === SCENE_KEYS.menu ? () => this.close() : undefined,
    );
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
    const badge = this.detail;
    this.detail = undefined;
    this.render();
    this.page?.focusBadge(badge);
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
        this.act({ tab: next });
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
    this.dragging = false;
    this.scroll = releaseScroll(LIST_SCROLL_RULE, true, this.time.now, this.scroll);
  }

  private down(point: Point): void {
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
      this.render();
    }
  }

  private up(cancelled: boolean): boolean {
    const accepted = !cancelled && !this.dragging;
    this.dragging = false;
    this.scroll = releaseScroll(
      LIST_SCROLL_RULE,
      currentSettings(this).reducedMotion,
      this.time.now,
      this.scroll,
    );
    return !accepted;
  }

  private render(): void {
    const place = htmlPanelPlace(this);
    if (place === undefined) {
      return;
    }
    const badges = this.badges();
    const save = profileSave(this);
    const measure = {
      ...canvasDetailMeasure(this),
      bodyInk: (line: string) => lineInk(place.fonts.body, shownText("body", line)),
    };
    const view = logbookView(measure, gameData, {
      badges,
      save,
      tab: this.tab,
    });
    this.scroll = resizeScroll(scrollMax(VIEW, view.content.bottom), this.scroll);
    const key = JSON.stringify([this.tab, view.content, view.frame, view.page.title]);
    if (this.page === undefined || this.pageKey !== key) {
      this.page?.destroy();
      const panelInput = htmlPanelInput(place);
      const point = (event: MouseEvent) =>
        panelInput.toGame({ x: event.clientX, y: event.clientY });
      this.page = followScene(
        this,
        showLogbook(place.layer, {
          ...panelInput,
          artUrl: domArtUrl,
          everyFrame: (step) => {
            this.game.events.on(Core.Events.PRE_RENDER, step);
            return () => this.game.events.off(Core.Events.PRE_RENDER, step);
          },
          loadSheet,
          navigation: {
            activate: (target) => this.act(target),
            close: () => this.close(),
            focus: (rect) => {
              this.scroll = scrollToShow(VIEW, rect, this.scroll);
            },
            gesture: {
              cancel: () => this.cancelPress(),
              down: (event) => this.down(point(event)),
              move: (event) => this.move(point(event)),
              up: (_event, cancelled) => this.up(cancelled),
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
