# Cheats

Browser tabs and installed apps offer one **Cheats** entry in the applicable Menu or Pause. The shared [Saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) governs cheat sessions and save guards.

## Cheat session

Cheats never touch the save. The first cheat used starts a cheat session; opening the modal does not.

- **During a session:** nothing is saved, earned or banked. Granted cash and unlocks, Pet shop purchases, picks, walks, banked earnings, statistics, records and checkpoints all stay in the session. No badge is earned in a session; a badge earned before it waits to celebrate until the session ends.
- **On the Start screen:** cheats used there apply to the Start screen at once, with its Pet shop, Logbook and Settings pages, and to the walk the next Start walk begins.
- **Run links:** in a browser tab, opening a link with any run parameter, a seed alone included, starts a session, so a reproduced walk saves nothing.
- **Ending:** the session ends when the game returns to the Start screen from a walk (going home from the end screen, or Back to title), and when the game reloads or closes. Opening and closing a page over the Start screen does not end it. The session is never stored: when it ends, every cheat is off and the game shows the save as it was before the first cheat, its checkpoint included, so a walk closed before the session resumes as normal on the next launch.

## Modal

- **Size** follows measured content within the safe viewport. The body scrolls when needed and text stays full size. See the [Layout guide](../art/layout.md#modals) for interface measurements.
- **Frame** has a Cheats title, a top-right X and a centred primary Back at the bottom. Back and X return one layer to the invoking Menu or Pause and restore focus to Cheats.
- **Order** starts with Invincible owners and Start at, followed by Unlocks and Money side by side. Reset save follows without a section heading.
- **Controls** show On or Off directly below the right-aligned switch. Add buttons are repeatable. All cheats are available from Start and during a walk.

## Cheats

- **Invincible owners** toggles protection against heart costs from bumps and cards. The change applies immediately during a walk. From Start, it applies to the next walk. The label aligns with the left content edge. A horizontal rule separates the switch row from Start at.
- **Start at** shows one button per neighbourhood in game order. From Start, the button sets the starting neighbourhood and route for the next walk. During a walk it immediately starts the chosen neighbourhood within the same walk, including revisits or restarting the current neighbourhood. Skipped segments give no completion payout.
- **Unlocks** lists Unlock Walkers, Unlock Dog Slots, Unlock Dogs and Unlock Gear in that order. Each immediately grants the corresponding group in the cheat session.
- Under **Money**, Add $100, Add $1,000 and Add $10,000 each immediately add their stated amount to the cheat session's bank on every press.

Pocket item, Seed, Copy run link and Movement speed have no visible controls in the panel. Existing browser-tab run links and test setup still support run overrides.

## Other actions

Reset save is a save tool and starts no cheat session.

- **Reset save** stays visible at the end of the menu. It is enabled only when available storage contains a valid saved checkpoint, a recorded ended walk, a positive bank balance or an earned badge. Default saves, hint-only changes and cheat-only progress do not qualify. Unavailable storage or newer-version data disables it. Reset requires confirmation, which Cancel and X can dismiss. Accepting immediately prevents repeat attempts, clears the save and earned badges, and keeps device settings.
