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

| Token              | Value                                                 | Unit           | Scope                                                        | Source                                                 |
| ------------------ | ----------------------------------------------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| SHOP_LAYOUT.panel  | 16,44,328,500                                         | x,y,w,h px     | Large Shop/Logbook panel, bottom 544                         | [shop layout](../src/home/shopLayout.ts)               |
| SHOP_LAYOUT.row.x  | 28                                                    | px             | Page heading and row left edge                               | [shop layout](../src/home/shopLayout.ts)               |
| STATS_LAYOUT.rows  | Shop heading left; shop row right, allowing scrollbar | derived bounds | Logbook label/value columns                                  | [stats layout](../src/home/statsLayout.ts)             |
| SHOP_LAYOUT.list   | Top 148; height 324; bottom 472                       | y px           | Shared scrolling viewport                                    | [shop layout](../src/home/shopLayout.ts)               |
| page.dismissFooter | Top 480; height 48; bottom 528                        | y,h px         | Large list panel, 8px after list and 16px above panel bottom | [dismissal geometry](../src/ui/modal/dismissFooter.ts) |

Shop and Logbook share their page and list geometry. Use `shopListFrame` and `statsListFrame` for the actual scrolling/non-scrolling content room, rather than treating the page frame as the text rectangle. Settings uses Large width and a height capped by both its caller's safe capacity and `560 - 2 × 48 = 464px`; a full-height panel starts at y = 48 below the protected top bar. Its header/X, full-size version label above the centred Close footer and footer stay fixed while only rows and separators scroll. Focused Settings rows retain a complete inset 2-art-pixel cyan ring. Other full-screen pages retain their own bounds.

## Groups/columns

Treat the home pickers and Start walk as one vertical group. The three sections are contiguous; their individual cards keep their detailed chrome and hit geometry. Position the grid from the cards themselves, preserving the separate non-touch badge gutter.

| Token           | Value                      | Unit       | Scope                                 | Source                                                                           |
| --------------- | -------------------------- | ---------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| home.divider    | Strip rows 152–154         | y px       | Divider row 154, above picker group   | [home layout](../src/home/homeLayout.ts) and [style contract](style-guide.md#ui) |
| home.outer.gaps | 0 above; 4 below           | px         | Entire picker/action group            | [home export](../shared/export/layout.json)                                      |
| home.walker     | 6,155,348,85               | x,y,w,h px | Walker section                        | [home export](../shared/export/layout.json)                                      |
| home.dogs       | 6,240,348,183              | x,y,w,h px | Dogs section                          | [home export](../shared/export/layout.json)                                      |
| home.pocket     | 6,423,348,83               | x,y,w,h px | Pocket section                        | [home export](../shared/export/layout.json)                                      |
| home.start      | 32,508,296,48              | x,y,w,h px | Start walk, 2px below Pocket          | [home layout](../src/home/homeLayout.ts)                                         |
| home.columns    | Walker 4; Dogs 3; Pocket 5 | columns    | Card grids, tiles 8px apart both ways | [home layout](../src/home/homeLayout.ts)                                         |

Keep hero, shop, sign and actor anchors independent of picker padding. On results pages, [endResultsPlacement](../src/home/endLayout.ts) moves the summary and attached art together, bounds the panel above the button and badge clearance and centres the unchanged badge strip in the remaining band. Full-size Body 2× owner names wrap in their measured column; when complete owner rows exceed the allocated viewport, scroll only those rows, moving each face, bubble, tail, name and quote together. Title, earnings, badges and Back to title remain fixed; no name or quote is omitted or shrunk.

## Controls/targets

Visible faces, touch targets and focus outlines are separate rectangles. Keep the game's 48px action/target and 20px icon-face roles; shared document structure across games does not make their control sizes interchangeable. See [Controls](controls.md#sizing-and-spacing) for sizing and [interaction rules](controls.md#interaction-and-accessibility) for semantics.

| Token                  | Value                                 | Unit | Scope                                                  | Source                                         |
| ---------------------- | ------------------------------------- | ---- | ------------------------------------------------------ | ---------------------------------------------- |
| BUTTON_SIZE.wide       | 296×48                                | px   | Non-modal main actions                                 | [button geometry](../src/ui/buttonGeometry.ts) |
| BUTTON_SIZE.compact    | 128×48                                | px   | Non-modal secondary actions                            | [button geometry](../src/ui/buttonGeometry.ts) |
| BUTTON_SIZE.icon       | Face 20×20; glyph 16×16; target 48×48 | px   | Non-bar icon controls                                  | [button geometry](../src/ui/buttonGeometry.ts) |
| topbar.home.hit        | 48×48, rows 0–47                      | px   | Sound/Menu/Exit x = 216/264/312; else 264/312          | [home placement](../src/home/homeLayout.ts)    |
| topbar.home.pitch      | 48                                    | px   | Faces x = 230/278/326, y = 8; else 278/326             | [home placement](../src/home/homeLayout.ts)    |
| topbar.home.well       | 97 wide, at x = 5                     | px   | Home bank well                                         | [home placement](../src/home/homeLayout.ts)    |
| topbar.walk.hit        | 48×48, rows 0–47                      | px   | Two columns at x = 264/312; debuff bars win rows 40–47 | [walk HUD](../src/hud/walkHud.ts)              |
| home.start.focusOutset | 4                                     | px   | Full focus ring, to the canvas's last row              | [home layout](../src/home/homeLayout.ts)       |
| press.min              | 48×48                                 | px   | Least press area; overlaps go to the nearest centre    | [Controls](controls.md#sizing-and-spacing)     |

Modal actions use their full measured label/icon width plus padding, not the non-modal compact/wide width floors. Preserve prices, goals, reasons and full-size labels in every state.

HUD effect geometry follows the [walk-bar exception](controls.md#sizing-and-spacing): 24×24 native icons in 26×26 wells, no extra gap or horizontal hold inset, y = 5 wells and y = 6 icons. Size the group from the visible count, with no empty reservations, and centre it within `[102,264)` on x = 183; six wells span 156px and start at x = 105,131,157,183,209,235, while two start at x = 157,183. The fixed cash well is `(5,4,97,29)`, with 84px of ink room at 3× scale. Centre the current dollar-sign/amount visible-ink union horizontally and vertically; the reserved maximum width is not an alignment box. Native faces, glyphs and wells share the same layout projection. Sound and Pause/Menu faces are `(278,8,20,20)` and `(326,8,20,20)`, within unchanged 48px targets, drawn on the plum with no backing.

## Modals

Target the full logical viewport's vertical midpoint, then clamp the measured panel to its caller's protected area with 16px margins. Horizontal actor avoidance may move it left or right without changing that vertical placement. Do not centre in the remaining safe band instead. Full-scene celebrations, results and bespoke pages are separate roles.

| Token                            | Value                                                | Unit | Scope                                                                   | Source                                                                                          |
| -------------------------------- | ---------------------------------------------------- | ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| modal.width                      | Large 328 or Medium 264; clamp available width       | px   | Selected ordinary family; safe-width clamp                              | [local width adapter](../src/ui/modal/layout.ts)                                                |
| modal.height                     | Measured content; no fixed floor                     | px   | Full fonts, wrapped text and present groups                             | [Control contract](controls.md#sizing-and-spacing)                                              |
| modal.close.face                 | 20×20 at right/top inset 6                           | px   | Ordinary modal X                                                        | [close geometry](../src/ui/closeControl.ts)                                                     |
| modal.close.hit                  | 48×48, wholly inside top-right corner                | px   | Ordinary modal X                                                        | [close geometry](../src/ui/closeControl.ts)                                                     |
| modal.title.reserve              | 56 each side with X; 16 without                      | px   | Whole-panel-centred heading; 48px hit plus 8px gap                      | [title sizing](../src/ui/modal/layout.ts) and [title placement](../src/ui/barTitle.ts)          |
| modal.title.top                  | 24 above actual visible ink                          | px   | 15px capitals give header 63; 18px Quit? gives 66                       | [modal tokens](../src/ui/modalGeometry.ts)                                                      |
| pauseMenu.width / homeMenu.width | 264, Medium; full-size labels measured within family | px   | One measured width family across both menus                             | [shared menu measurement](../src/ui/navigationMenu.ts)                                          |
| pauseMenu.note.inner             | 232 = 264 − 2 × 16                                   | px   | Note plate width; text wraps at 224px after 4px plate padding each side | [pause layout](../src/hud/pauseMenu.ts) and [note measurement](../src/hud/questionPanelView.ts) |
| modal.content.bottom             | 16 after final visible content                       | px   | Includes any final note                                                 | [pause layout](../src/hud/pauseMenu.ts)                                                         |

Large contains 296px of body room and Medium 232px after 16px padding on both sides. Settings, rich details, lists and ordinary installation cards use Large; Pause/Menu, brief confirmations, optional Update and Purchase use Medium. Short details choose Medium only after their actual full-font body, heading and footer fit; otherwise use Large. Wrapping, action-row stacking and measured height derive from this room. The [control contract](controls.md#sizing-and-spacing) owns those family rules.

Use dedicated `MODAL_TITLE_SCALE = 3` for ordinary modal and framed-page headings. Measure actual glyph ink with [titleRole](../src/ui/modal/titleRole.ts), keeping 24px above and below it. Capital ink is 15px and its header 63px; punctuation can increase both. Wrap at a 36px pitch and grow header/body/panel height from actual ink. Body and action labels stay at 2×. End-results badge-strip headings retain their 2× section role. Modal controls, dismissal guards and safe keyboard choices remain defined in [Controls](controls.md#sizing-and-spacing). Width measurements must include every present group and action, not only the title.

Full-page Help remains a 360px exception: picture `(0,40,360,236)`, title y = 302 and a body-only 54px scroll viewport with all 18px-pitch lines retained. Dots at y = 412 retain full 48px hits above secondary Previous/Next at y = 444; primary Close is `(116,500,128,48)`. Keep the [page-specific contract](controls.md#sizing-and-spacing) and [`helpLayout`](../src/help/helpLayout.ts) separate from ordinary modal families.

## HUD/overlays

Keep gameplay notices below overlay scenes and scrims. A high object depth inside the run scene is not permission to draw above a modal. The message strip stays in the HUD with its paused lifetime and enlarged-card hiding; [messageStripView](../src/scenes/messageStripView.ts) owns its rendering.

| Token            | Value                                            | Unit       | Scope                                                                       | Source                                                                               |
| ---------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| hud.topBar       | 0,0,360,40                                       | x,y,w,h px | Walk bar                                                                    | [screen regions](../shared/export/layout.json)                                       |
| hud.walkView     | 0,40,360,442                                     | x,y,w,h px | Content between bar and dog row                                             | [screen regions](../shared/export/layout.json)                                       |
| hud.dogRow       | 0,482,360,74                                     | x,y,w,h px | Fixed three-slot card row                                                   | [screen regions](../shared/export/layout.json)                                       |
| progress.loading | Physical viewport top, full width, 3 CSS px high | CSS px     | One page-lifetime loading strip, independent of DPR and page-frame rotation | [startup](../src/startup.ts) and [DOM loading strip](../src/ui/dom/domLoadingBar.ts) |

Hide the shared loading strip while idle. Startup, Boot, home, walk-loading, offline installation and required updates use the same physical-top strip; there is no Home-yard or Boot secondary gauge. The neighbourhood route-progress meter is separate. Progress state and appearance follow the [style contract](style-guide.md#ui). Actor-following effects and stationary art notices keep their own anchors; do not apply panel-centering rules to them.

## Exceptions and verification

Keep intentional geometry explicit: compact top bars, steering gestures, hold-to-explain controls, illustrated choice cards, edge-to-edge dog cards, full-scene hero titles, scrolling pages and the measured result/badge group. These exceptions do not authorize shrinking text or targets; only the debuff bars and effect wells keep press areas under 48px. Their detailed contracts remain in [Controls](controls.md#scope-and-exceptions).

Loading recovery uses a fixed CSS panel and typography with the ordinary logical action fit, under the [recovery exception](controls.md#scope-and-exceptions). Keep that role separate from the ordinary modal tables.

Before changing a layout, identify its coordinate space, page bounds, present groups, visible-ink extents, target rectangles and protected areas. Check smallest safe width, wrapped content, close-hit clearance, scrollbar reservation, focus outsets and empty groups. Compare neutral and selected card edges without counting badges as grid padding. Verify overlay ordering and unchanged dismissal behaviour.

Read the owning source and committed export together. A changed layout needs matching exports and focused checks; a documentation-only correction needs formatting and Markdown lint. Use a bounded visual check only for a concrete unresolved visual question.
