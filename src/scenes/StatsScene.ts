import { clampIndex } from "@andornaut/game-kit/arrays";
import { containsPoint, type Rect } from "@andornaut/game-kit/rect";
import { type GameObjects, Scene } from "phaser";

import { gameData } from "../data/index.ts";
import { type BadgeView, badgeWall } from "../home/badgesView.ts";
import { FEEDBACK } from "../home/feedback.ts";
import { focusDirectionForKey } from "../home/focus.ts";
import { overlayRegion, regionOutside } from "../home/homeBar.ts";
import { type LogbookView, logbookView } from "../home/logbookView.ts";
import {
  STATS_LAYOUT,
  STATS_TABS,
  statsScrollbar,
  type StatsTab,
  statsTabRects,
} from "../home/statsLayout.ts";
import type { LogbookScroll } from "../hud/dom/logbook.ts";
import { isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import {
  isDragging,
  type ListScroll,
  listScroll,
  pageKeyScroll,
  resizeScroll,
  scrollBy,
  scrollMax,
  stepScroll,
} from "../input/listScroll.ts";
import { exitShown } from "../pwa/index.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import { badgeCard, drawBadgeCard } from "./badges.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import { addDetailContent } from "./homePanels.ts";
import { canvasDetailMeasure } from "./modalMeasure.ts";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay.ts";
import { currentSettings, earnedAchievements, profileSave } from "./profileStore.ts";
import { addHtmlBadgeCard, addHtmlLogbook, keepPanel, type KeptPanel } from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import {
  addScrollbar,
  LIST_SCROLL_RULE,
  listenListScroll,
  maskToRect,
  placeScrollbar,
  type ScrollbarView,
} from "./scrollView.ts";
import { addShopPage, addShopTabs } from "./shopPage.ts";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress.ts";
import { addTapBurst, clearScene } from "./uiKit.ts";

type Tab = StatsTab;
type Target = "close" | { badge: number } | { tab: number };
// A press while a badge's detail is open dismisses it, wherever it lands.
type Press = Target | "dismiss";

const TABS = STATS_TABS;
const TAB_RECTS: readonly Rect[] = statsTabRects();
const CLOSE = STATS_LAYOUT.close;
const PANEL: Rect = STATS_LAYOUT.panel;
const VIEW: Rect = STATS_LAYOUT.view;
const SCROLL = STATS_LAYOUT.scroll;
// A screen-sized texture, white over the view: the mask that clips each tab's content to it.
const VIEW_MASK_KEY = "stats-view-mask";
// The tab the Logbook opens on, its first.
const OPEN_TAB: Tab = "badges";

// The Logbook, which the home screen's Logbook button opens, on the Pet shop's page under the
// home screen's top bar (addShopPage), in three tabs: the badge wall, a badge per row, where
// tapping a badge opens its name, goal and line; a block per dog with its walks, zones and
// firings; and overall figures and walks by outcome. A tab longer than the shop's list area
// scrolls in it by a drag, the wheel, the arrow keys or the page keys, with the shop's
// scrollbar beside it; a drag taps nothing.
export class StatsScene extends Scene {
  private burst = false;
  // The open tab's content, clipped to the view and moved up by the scroll.
  private content: GameObjects.Container | undefined;
  private detail: number | undefined;
  // The page and an open badge's card drawn in HTML, while each shows.
  private htmlCard: KeptPanel | undefined;
  private htmlPage: KeptPanel | undefined;
  private pressed: Target | undefined;
  private presses: TargetPressListener | undefined;
  private resumeKey: SceneKey | undefined;
  private scroll: ListScroll = listScroll(0);
  private scrollbar: ScrollbarView | undefined;
  private tab: Tab = OPEN_TAB;
  // The badge wall's rows as last drawn, each badge's tap target.
  private wallRows: Rect[] = [];

  constructor() {
    super(SCENE_KEYS.stats);
  }

  create(data?: OverlayData): void {
    this.resumeKey = data?.resume;
    // The scene's shutdown destroyed any HTML page and card.
    this.htmlCard = undefined;
    this.htmlPage = undefined;
    this.pressed = undefined;
    this.detail = undefined;
    this.scroll = listScroll(0);
    this.tab = OPEN_TAB;
    this.render();

    // A pressed tab dips, then opens. With a badge's detail open, a tap on the page's card
    // closes the detail, and one off the card closes the page, as on the shop.
    this.presses = listenTargetPress<Press>(this, {
      dipMs: (target) => (typeof target === "object" && "tab" in target ? FEEDBACK.pressDipMs : 0),
      onDown: (pointer) => {
        // Over the HTML page and card, so a burst shows over them.
        const html = this.htmlCard?.panel ?? this.htmlPage?.panel;
        if (html === undefined) {
          addTapBurst(this, pointer.x, pointer.y);
        } else {
          html.burst({ x: pointer.x, y: pointer.y });
        }
      },
      onPressed: (target) => {
        this.pressed = target === "dismiss" ? undefined : target;
        this.render();
      },
      onTap: (target) => {
        if (target === "dismiss") {
          this.detail = undefined;
        } else if (target === "close") {
          this.close();
          return;
        } else if ("tab" in target) {
          this.openTab(TABS[target.tab] ?? this.tab);
        } else {
          this.detail = target.badge;
          this.burst = true;
        }
        this.render();
      },
      same: sameByValue,
      targetAt: (x, y) => {
        if (this.detail === undefined) {
          return this.targetAt(x, y);
        }
        return containsPoint(PANEL, x, y) ? "dismiss" : undefined;
      },
    });
    listenListScroll(this, {
      active: () => this.detail === undefined,
      onDragStart: () => {
        this.presses?.cancel();
        this.pressed = undefined;
        this.render();
      },
      place: () => this.placeContent(),
      rule: LIST_SCROLL_RULE,
      scroll: () => this.scroll,
      setScroll: (scroll) => {
        this.scroll = scroll;
      },
      view: VIEW,
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!menuKeyActs(event.repeat, event.code)) {
        return;
      }
      if (isPauseKey(event.code) || isConfirmKey(event.code)) {
        this.back();
        return;
      }
      if (this.detail !== undefined) {
        return;
      }
      const direction = focusDirectionForKey(event.code);
      const paged = pageKeyScroll(VIEW.height - SCROLL.pageOverlap, event.code, this.scroll);
      if (paged !== undefined || direction === "up" || direction === "down") {
        const step = direction === "up" ? -SCROLL.keyStep : SCROLL.keyStep;
        this.scroll = paged ?? scrollBy(step, this.scroll);
        this.placeContent();
        return;
      }
      if (direction === "left" || direction === "right") {
        const index = TABS.indexOf(this.tab);
        const next = clampIndex(TABS.length, index + (direction === "left" ? -1 : 1));
        if (next !== index) {
          this.openTabAfterDip(next);
        }
      }
    });
    // The top bar's empty area and the margins around the card close the page, as on the shop,
    // and the top bar's buttons keep their own taps. Back closes an open badge first, as Escape
    // does.
    const exit = exitShown();
    listenDismiss(
      this,
      regionOutside(exit, "home", 0, [PANEL]),
      () => this.close(),
      () => this.back(),
    );
    listenHomeBar(this, exit, () => this.close());
  }

  // An open badge closes, else the page.
  private back(): void {
    if (this.detail === undefined) {
      this.close();
      return;
    }
    this.detail = undefined;
    this.render();
  }

  override update(_time: number, deltaMs: number): void {
    const flung = stepScroll(LIST_SCROLL_RULE, deltaMs, this.scroll);
    if (flung !== this.scroll) {
      this.scroll = flung;
      this.placeContent();
    }
  }

  // The open tab's content at its scroll, and the scrollbar's thumb beside it.
  private placeContent(): void {
    this.content?.setY(-this.scroll.y);
    placeScrollbar(statsScrollbar(this.scroll.max, this.scroll.y), this.scrollbar);
  }

  // Another tab opens at its top.
  private openTab(tab: Tab): void {
    if (tab !== this.tab) {
      this.scroll = listScroll(0);
    }
    this.tab = tab;
  }

  private targetAt(x: number, y: number): Target | undefined {
    if (containsPoint(CLOSE.hit, x, y)) {
      return "close";
    }
    const tab = rectIndexAt(TAB_RECTS, x, y);
    if (tab !== undefined) {
      return { tab };
    }
    // Only the view's part of a badge's row is pressed.
    const onWall = this.tab === "badges" && containsPoint(VIEW, x, y);
    const badge = onWall ? rectIndexAt(this.wallRows, x, y + this.scroll.y) : undefined;
    return badge === undefined ? undefined : { badge };
  }

  // A key presses the tab: it dips, then opens.
  private openTabAfterDip(index: number): void {
    this.pressed = { tab: index };
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => {
      this.pressed = undefined;
      this.openTab(TABS[index] ?? this.tab);
      this.render();
    });
  }

  private close(): void {
    closeOverlay(this.resumeKey, this);
  }

  // The list's scroll as the HTML follows it: settled while no drag or fling moves it.
  private htmlScroll(): LogbookScroll {
    const { max, velocity, y } = this.scroll;
    return { max, settled: !isDragging(this.scroll) && velocity === 0, y };
  }

  // The page, its tabs and the open tab, and an open badge's card: in HTML where the page's
  // switch is on and its fonts are ready, each kept while it shows the same, else on the canvas.
  private render(): void {
    clearScene(this);
    this.content = undefined;
    this.scrollbar = undefined;
    const words = gameData.menuText.stats;
    const pressed = this.pressed;
    const view = logbookView(canvasDetailMeasure(this), gameData, {
      badges: this.badges(),
      closePressed: pressed === "close",
      pressedTab: typeof pressed === "object" && "tab" in pressed ? pressed.tab : undefined,
      save: profileSave(this),
      tab: this.tab,
    });
    this.wallRows = [...view.wallRows];
    this.scroll = resizeScroll(scrollMax(VIEW, view.content.bottom), this.scroll);
    const open = this.detail === undefined ? undefined : this.badges()[this.detail];
    const card =
      open === undefined
        ? undefined
        : badgeCard(this, overlayRegion("home"), {
            badge: open,
            burst: this.burst,
            reduced: currentSettings(this).reducedMotion,
          });
    this.burst = false;
    const page = this.htmlPage;
    this.htmlPage = keepPanel(page, JSON.stringify(view), () =>
      addHtmlLogbook(this, view, () => this.htmlScroll()),
    );
    // A page drawn again goes over the card, which must then be drawn again over it.
    if (this.htmlPage !== page) {
      this.htmlCard?.panel?.destroy();
      this.htmlCard = undefined;
    }
    this.htmlCard = keepPanel(this.htmlCard, card && JSON.stringify(card), () =>
      card === undefined ? undefined : addHtmlBadgeCard(this, card),
    );
    if (this.htmlPage?.panel === undefined) {
      this.drawPage(view, words);
    }
    if (card !== undefined && this.htmlCard?.panel === undefined) {
      drawBadgeCard(this, this.add.container(0, 0), card);
    }
  }

  // The page, its tabs and the open tab's content on the canvas, as its view lays them out, the
  // content clipped to the view and moved up by the scroll.
  private drawPage(view: LogbookView, words: typeof gameData.menuText.stats): void {
    const root = this.add.container(0, 0);
    addShopPage(this, root, view.page.closePressed, words.title);
    addShopTabs(
      this,
      root,
      TABS.map((tab, i) => ({
        label: words.tabs[tab],
        open: tab === this.tab,
        pressed: sameByValue({ tab: i }, this.pressed),
      })),
    );
    const content = this.add.container(0, 0);
    root.add(content);
    this.content = content;
    const g = this.add.graphics();
    content.add(g);
    for (const { colour, rect } of view.content.fills) {
      fillRect(g, colour, rect);
    }
    addDetailContent(this, content, view.content);
    maskToRect(this, VIEW_MASK_KEY, view.frame.rect, content);
    this.scrollbar = addScrollbar(this, root, statsScrollbar(this.scroll.max, this.scroll.y));
    this.placeContent();
  }

  private badges(): BadgeView[] {
    return badgeWall(gameData, earnedAchievements(this));
  }
}
