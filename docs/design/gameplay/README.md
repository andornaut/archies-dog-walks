# Gameplay

Archie's Dog Walks is a phone-first pixel-art game playable in a web browser and installable where supported.

## Docs

| Reference                           | Covers                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| [Design](design.md)                 | Premise, pillars and core loop                             |
| [Rules](rules.md)                   | Controls, navigation, saves, walk lifecycle and feedback   |
| [Pack](pack.md)                     | Dogs, walkers, formation, bumps, pulls and owner happiness |
| [Neighbourhoods](neighbourhoods.md) | Routes, rosters, hazards and spawn rules                   |
| [Encounters](encounters.md)         | Choice cards, contact effects, pickups and upgrades        |
| [Economy](economy.md)               | Cash, pay, Start picks, purchases and progression          |
| [Player copy](player-copy.md)       | Character voice, wording, fit and authored data            |
| [Tuning](tuning.md)                 | Balance targets, measurements and playtesting              |

[Ideas](ideas.md) collects undecided and cut proposals. [Cheats](cheats.md) covers cheats and save tools. [Layout](../../../art/layout.md) owns interface measurements.

The shared [game policies](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md) govern cross-game behaviour.

Docs state the current rule only; git keeps the history. [`ideas.md`](ideas.md) follows the shared [Ideas policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#ideas).

## Scope

Gameplay owns the rulebook and the values and content in the data value files (every `src/data/*.ts` except `index.ts`, `layout.ts`, `screen.ts`, `types.ts` and the tests). A new field or effect kind goes through tech.

## Method

- **Design sessions:** start with "design session" and a topic. Keep floated ideas apart from agreed ones, ask the question that unblocks a decision, and on "wrap up" propose doc changes, writing them once confirmed.
- [Playtesting](tuning.md#playtesting) and [Card text](player-copy.md#card-text) have their own reference sections.

## Targets

See [Tuning targets](tuning.md#targets) for the balance goals.

## Release and tuning

See [Release and tuning](tuning.md#release-and-tuning) for the walk and generation targets, and [Loading and updates](rules.md#loading-and-updates) for save compatibility.
