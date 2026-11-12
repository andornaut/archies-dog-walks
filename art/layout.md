# Layout

Geometry and alignment for Archie's Dog Walks. [Controls](controls.md) remains canonical for interaction, selection, accessibility and control states; the [style guide](style-guide.md) owns colour, typography and illustration.

Each table's Source names the implementation or committed layout export that defines the value. Token names describe the contract; they are not runtime exports.

## Coordinates and scale

Use logical game pixels for canvas layout and CSS pixels for native DOM surfaces. Rectangles are `(x,y,width,height)`, with right and bottom edges exclusive. Centre measured visible ink and actual card edges rather than font advance padding or badge overhang. Round final canvas placement to whole logical pixels.

| Token          | Value                                             | Unit   | Scope                 | Source                                 |
| -------------- | ------------------------------------------------- | ------ | --------------------- | -------------------------------------- |
| screen.logical | 360×560                                           | px     | Canvas viewport       | [screen config](../src/data/screen.ts) |
| screen.centre  | 180,280                                           | x,y px | Full logical viewport | Derived from `screen.logical`          |
| screen.fit     | Fit, top aligned, horizontally centred, pixelated | scale  | Browser canvas        | [Phaser setup](../src/main.ts)         |

Browser safe-area handling belongs to the [page shell](../src/main.css). A CSS/device pixel is not automatically one logical game pixel.

## Spacing tokens

Use 4/8/16 for the ordinary row/group/panel spacing roles, and the button gaps for neighbouring button faces. Named exceptions keep their own gaps; do not round every gap to this sequence.

| Token                             | Value | Unit       | Scope                                                 | Source                                     |
| --------------------------------- | ----- | ---------- | ----------------------------------------------------- | ------------------------------------------ |
| BUTTON_SIZE.gap                   | 16    | px         | Side-by-side standard buttons, modal actions included | [layout data](../src/data/layout.ts)       |
| BUTTON_SIZE.smallGap              | 24    | px         | Small buttons, in any direction                       | [layout data](../src/data/layout.ts)       |
| BUTTON_SIZE.stackGap              | 8     | px         | Stacked standard buttons, list rows and tile grids    | [layout data](../src/data/layout.ts)       |
| HOME_LAYOUT.sectionContentPadding | 4     | px minimum | Measured home card-edge clearance                     | [home layout](../src/home/homeLayout.ts)   |
| MODAL.gap                         | 8     | px         | Present groups                                        | [modal tokens](../src/ui/modalGeometry.ts) |
| MODAL.pad / MODAL.margin          | 16    | px         | Panel content / caller's protected area               | [modal tokens](../src/ui/modalGeometry.ts) |
| MODAL.rowGap                      | 4     | px         | Text rows                                             | [modal tokens](../src/ui/modalGeometry.ts) |

The [button gaps](controls.md#sizing-and-spacing) define which buttons are small and list the exemptions. Omit absent groups and their gaps. Keep the full font role; wrap text or grow its measured container rather than reducing its scale. Detailed ink gaps remain in [Controls](controls.md#labels-and-icons).

## Page bounds/alignment

Choose one content rectangle for each page. Derive its outer margins, button edges and statistics label/value columns from that rectangle and its inset. Reserve scrollbar and close-control space before deriving those columns. Do not independently offset a button or statistic to make it appear aligned.

| Token             | Value                                                 | Unit           | Scope                          | Source                                     |
| ----------------- | ----------------------------------------------------- | -------------- | ------------------------------ | ------------------------------------------ |
| SHOP_LAYOUT.panel | 4,44,352,512                                          | x,y,w,h px     | Shop and Logbook page frame    | [shop layout](../src/home/shopLayout.ts)   |
| SHOP_LAYOUT.row.x | 16                                                    | px             | Page heading and row left edge | [shop layout](../src/home/shopLayout.ts)   |
| STATS_LAYOUT.rows | Shop heading left; shop row right, allowing scrollbar | derived bounds | Logbook label/value columns    | [stats layout](../src/home/statsLayout.ts) |
| SHOP_LAYOUT.list  | Top 137; bottom 548                                   | y px           | Shared scrolling viewport      | [shop layout](../src/home/shopLayout.ts)   |

Shop and Logbook share their page and list geometry. Use `shopListFrame` and `statsListFrame` for the actual scrolling/non-scrolling content room, rather than treating the page frame as the text rectangle. Other full-screen pages retain their own bounds.

## Groups/columns

Treat the home pickers and Start walk as one vertical group. The three sections are contiguous; their individual cards keep their detailed chrome and hit geometry. Position the grid from the cards themselves, preserving the separate non-touch badge gutter.

| Token           | Value                      | Unit       | Scope                               | Source                                                                           |
| --------------- | -------------------------- | ---------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| home.divider    | Row 166                    | y px       | Last divider row above picker group | [home layout](../src/home/homeLayout.ts) and [style contract](style-guide.md#ui) |
| home.outer.gaps | 6 above; 2 below           | px         | Entire picker/action group          | [home export](../shared/export/layout.json)                                      |
| home.walker     | 6,173,348,85               | x,y,w,h px | Walker section                      | [home export](../shared/export/layout.json)                                      |
| home.dogs       | 6,258,348,171              | x,y,w,h px | Dogs section                        | [home export](../shared/export/layout.json)                                      |
| home.pocket     | 6,429,348,83               | x,y,w,h px | Pocket section                      | [home export](../shared/export/layout.json)                                      |
| home.start      | 32,514,296,44              | x,y,w,h px | Start walk, 2px below Pocket        | [home layout](../src/home/homeLayout.ts)                                         |
| home.columns    | Walker 4; Dogs 3; Pocket 5 | columns    | Card grids, 8px gaps both ways      | [home layout](../src/home/homeLayout.ts)                                         |

Keep hero, shop, sign and actor anchors independent of picker padding. On results pages, [endResultsPlacement](../src/home/endLayout.ts) moves the summary and attached art together, clamps measured summary/badge heights above the button clearance and centres the whole unchanged badge strip in the remaining band.

## Controls/targets

Visible faces, touch targets and focus outlines are separate rectangles. Keep the game's 44px action/target and 20px icon-face roles; shared document structure across games does not make their control sizes interchangeable. See [Controls](controls.md#sizing-and-spacing) for sizing and [interaction rules](controls.md#interaction-and-accessibility) for semantics.

| Token                  | Value                                 | Unit | Scope                                                  | Source                                         |
| ---------------------- | ------------------------------------- | ---- | ------------------------------------------------------ | ---------------------------------------------- |
| BUTTON_SIZE.wide       | 296×44                                | px   | Non-modal main actions                                 | [button geometry](../src/ui/buttonGeometry.ts) |
| BUTTON_SIZE.compact    | 128×44                                | px   | Non-modal secondary actions                            | [button geometry](../src/ui/buttonGeometry.ts) |
| BUTTON_SIZE.icon       | Face 20×20; glyph 16×16; target 44×44 | px   | Non-bar icon controls                                  | [button geometry](../src/ui/buttonGeometry.ts) |
| topbar.home.hit        | 34×44                                 | px   | Compact home bar exception                             | [home placement](../src/home/homeLayout.ts)    |
| topbar.home.pitch      | 44                                    | px   | Home bar faces, 24px apart                             | [home placement](../src/home/homeLayout.ts)    |
| topbar.home.well       | At most 136 wide                      | px   | Home bank well                                         | [home placement](../src/home/homeLayout.ts)    |
| topbar.walk.hit        | 34×40                                 | px   | Compact walk bar; debuff rows 40–43 remain interactive | [walk HUD](../src/hud/walkHud.ts)              |
| home.start.focusOutset | 2                                     | px   | Focus outline limited by bottom clearance              | [home layout](../src/home/homeLayout.ts)       |

Modal actions use their full measured label/icon width plus padding, not the non-modal compact/wide width floors. Preserve prices, goals, reasons and full-size labels in every state.

## Modals

Target the full logical viewport's vertical midpoint, then clamp the measured panel to its caller's protected area with 16px margins. Horizontal actor avoidance may move it left or right without changing that vertical placement. Do not centre in the remaining safe band instead. Full-scene celebrations, results and bespoke pages are separate roles.

| Token               | Value                                                       | Unit | Scope                                                             | Source                                                                                  |
| ------------------- | ----------------------------------------------------------- | ---- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| modal.width         | min(available, max(content ink + 32, viewport width × 0.5)) | px   | Unpadded content; 180px floor on 360px viewport, safe-width clamp | [local width adapter](../src/home/modalLayout.ts)                                       |
| modal.height        | Measured content; no fixed floor                            | px   | Full fonts, wrapped text and present groups                       | [Control contract](controls.md#sizing-and-spacing)                                      |
| modal.close.face    | 20×20 at right/top inset 6                                  | px   | Ordinary modal X                                                  | [close geometry](../src/ui/closeControl.ts)                                             |
| modal.close.hit     | 44×44, wholly inside top-right corner                       | px   | Ordinary modal X                                                  | [close geometry](../src/ui/closeControl.ts)                                             |
| modal.title.reserve | 52 each side with X; 16 without                             | px   | Whole-panel-centred heading; 44px hit plus 8px gap                | [title sizing](../src/home/modalLayout.ts) and [title placement](../src/ui/barTitle.ts) |

Keep `font-title` at 2×. Measure wrapped lines and increase header/body/panel height by their line pitch; a single-line header stays 52px. Modal controls, dismissal guards and safe keyboard choices remain defined in [Controls](controls.md#sizing-and-spacing). Width measurements must include every present group and action, not only the title.

## HUD/overlays

Keep gameplay notices below overlay scenes and scrims. A high object depth inside the run scene is not permission to draw above a modal. The message strip stays in the HUD with its paused lifetime and enlarged-card hiding; [messageStripView](../src/scenes/messageStripView.ts) owns its rendering.

| Token           | Value        | Unit       | Scope                           | Source                                                                                                              |
| --------------- | ------------ | ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| hud.topBar      | 0,0,360,40   | x,y,w,h px | Walk bar                        | [screen regions](../shared/export/layout.json)                                                                      |
| hud.walkView    | 0,40,360,442 | x,y,w,h px | Content between bar and dog row | [screen regions](../shared/export/layout.json)                                                                      |
| hud.dogRow      | 0,482,360,74 | x,y,w,h px | Fixed three-slot card row       | [screen regions](../shared/export/layout.json)                                                                      |
| progress.bottom | 0,556,360,4  | x,y,w,h px | DOM startup, Boot and run       | [startup](../src/startup.ts), [Boot](../src/scenes/BootScene.ts) and [screen regions](../shared/export/layout.json) |
| progress.home   | 0,168,360,4  | x,y,w,h px | Home loading/walk-wait only     | [home layout](../src/home/homeLayout.ts)                                                                            |

Hide home progress while idle: rows 167–172 are then clear. Active progress leaves rows 167 and 172 clear. Progress state and appearance follow the [style contract](style-guide.md#ui). Actor-following effects and stationary art notices keep their own anchors; do not apply panel-centering rules to them.

## Exceptions and verification

Keep intentional geometry explicit: compact top bars, steering gestures, hold-to-explain controls, illustrated choice cards, full-scene hero titles, scrolling pages and the measured result/badge group. These exceptions do not authorize shrinking text or targets. Their detailed contracts remain in [Controls](controls.md#scope-and-exceptions).

Before changing a layout, identify its coordinate space, page bounds, present groups, visible-ink extents, target rectangles and protected areas. Check smallest safe width, wrapped content, close-hit clearance, scrollbar reservation, focus outsets and empty groups. Compare neutral and selected card edges without counting badges as grid padding. Verify overlay ordering and unchanged dismissal behaviour.

Read the owning source and committed export together. A changed layout needs matching exports and focused checks; a documentation-only correction needs formatting and Markdown lint. Use a bounded visual check only for a concrete unresolved visual question.
