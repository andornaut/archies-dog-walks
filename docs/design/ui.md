# UI

Ordinary screens, overlays, choice cards and the walk HUD render as native DOM views on game-kit's shared UI modules; Phaser draws the road, backdrops, actors, world effects, Boot's art and Help's illustrations, and art only the native interface draws ships outside the Phaser atlas. Every part sits on the art-pixel grid, press areas are at least 48 game px, and button faces keep the kit's gaps. Modals use the Large (328) or Medium (264) width family with a 16 logical px margin and content height; under a modal the whole background, top controls included, is dimmed and inactive, a dismissible modal closes from a centred footer and its corner X, and the primary action is bottommost or rightmost. Text on a backing centres on its visible ink. One 3 CSS px strip at the physical top of the viewport shows loading the player waits for, and a required file that fails to load shows the shared error with Retry.

Reference: [Screens and UI](../../src/README.md#screens-and-ui), [Assets](../../src/README.md#assets), [Phone](../../src/README.md#phone).

## Work items

| ID       | Title                                                            | Link                               |
| -------- | ---------------------------------------------------------------- | ---------------------------------- |
| adw-0077 | Play the tip sparkle over the lead dog for cash gains            | [adw-0077.md](../work/adw-0077.md) |
| adw-0091 | Draw the interface in HTML over the canvas                       | [adw-0091.md](../work/adw-0091.md) |
| adw-0093 | Space buttons by the kit's button gaps                           | [adw-0093.md](../work/adw-0093.md) |
| adw-0094 | Show loading bars only while the player waits                    | [adw-0094.md](../work/adw-0094.md) |
| adw-0096 | Serve the HTML interface's stylesheet as a CSS file              | [adw-0096.md](../work/adw-0096.md) |
| adw-0103 | Give every press area 48 px                                      | [adw-0103.md](../work/adw-0103.md) |
| adw-0107 | Show a script focus ring only after keyboard input               | [adw-0107.md](../work/adw-0107.md) |
| adw-0109 | Name each setting's state and effect                             | [adw-0109.md](../work/adw-0109.md) |
| adw-0113 | Prevent text selection across the game UI                        | [adw-0113.md](../work/adw-0113.md) |
| adw-0116 | Centre a button that is alone in its row                         | [adw-0116.md](../work/adw-0116.md) |
| adw-0117 | Share one top bar layout across screens                          | [adw-0117.md](../work/adw-0117.md) |
| adw-0118 | Centre backed labels and inline pills on their visible ink       | [adw-0118.md](../work/adw-0118.md) |
| adw-0124 | Compose Pause and Menu as one navigation modal                   | [adw-0124.md](../work/adw-0124.md) |
| adw-0125 | Render the interface natively on game-kit                        | [adw-0125.md](../work/adw-0125.md) |
| adw-0127 | Show one top loading strip and Retry required files              | [adw-0127.md](../work/adw-0127.md) |
| adw-0128 | Keep only Sound and Pause in the walk top bar                    | [adw-0128.md](../work/adw-0128.md) |
| adw-0129 | Reserve five characters for cash and keep effects static         | [adw-0129.md](../work/adw-0129.md) |
| adw-0133 | Fix the home header bands and shop sign                          | [adw-0133.md](../work/adw-0133.md) |
| adw-0134 | Enlarge modal titles and balance their padding                   | [adw-0134.md](../work/adw-0134.md) |
| adw-0135 | Add Back to title above the primary action in Pause and Menu     | [adw-0135.md](../work/adw-0135.md) |
| adw-0136 | Restore modal dimming on live screens                            | [adw-0136.md](../work/adw-0136.md) |
| adw-0138 | Close every dismissible modal from a centred footer              | [adw-0138.md](../work/adw-0138.md) |
| adw-0139 | Apply the shared Retry presentation                              | [adw-0139.md](../work/adw-0139.md) |
| adw-0140 | Size modals by width family                                      | [adw-0140.md](../work/adw-0140.md) |
| adw-0141 | Use readable minimum type in signs, pills and results            | [adw-0141.md](../work/adw-0141.md) |
| adw-0145 | Place the primary action bottom or right                         | [adw-0145.md](../work/adw-0145.md) |
| adw-0146 | Show the version above Close in Settings                         | [adw-0146.md](../work/adw-0146.md) |
| adw-0147 | Fix Settings scrolling and focus on touch                        | [adw-0147.md](../work/adw-0147.md) |
| adw-0150 | Bind each discrete control's hold to its action                  | [adw-0150.md](../work/adw-0150.md) |
| adw-0151 | Remove the labelled Close from confirmations                     | [adw-0151.md](../work/adw-0151.md) |
| adw-0152 | Remove mute from loading and Retry                               | [adw-0152.md](../work/adw-0152.md) |
| adw-0155 | Dim and still the whole background under a modal                 | [adw-0155.md](../work/adw-0155.md) |
| adw-0157 | Leave native-only chrome out of the Phaser atlas                 | [adw-0157.md](../work/adw-0157.md) |
| adw-0160 | Size the celebrations and loading error by width family          | [adw-0160.md](../work/adw-0160.md) |
| adw-0165 | Order the Pause and Menu modal and show Exit only where it works | [adw-0165.md](../work/adw-0165.md) |
| adw-0167 | Make Help a page and frame its pictures                          | [adw-0167.md](../work/adw-0167.md) |
