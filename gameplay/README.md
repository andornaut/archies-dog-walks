# Gameplay

The design of the game, its targets, and how it is tuned and tested. A pixel-art game (simple, retro, cute) about being a dog walker. Web first, then iOS and Android.

## Docs

| Doc                      | What it holds                   | Changes when            |
| ------------------------ | ------------------------------- | ----------------------- |
| [`design.md`](design.md) | The rulebook: rules and content | A design decision lands |
| [`ideas.md`](ideas.md)   | Undecided and cut ideas         | Every design session    |

Docs state the current rule only; git keeps the history. An idea stays in `ideas.md` until agreed, then moves to the doc it belongs in.

## Scope

Gameplay owns the rulebook and the values and content in the data value files (every `src/data/*.ts` except `types.ts`, `index.ts`, `screen.ts` and the tests). A new field or effect kind goes through tech.

## Method

- **Design sessions:** start with "design session" and a topic. Claude keeps floated ideas apart from agreed ones, asks the question that unblocks a decision, and on "wrap up" proposes doc changes, writing them once confirmed.
- **Playtesting:** the user playtests on devices. Run a bounded simulation batch only for a specific gameplay question that unit tests cannot answer.
- **Card text:** generated from the effects, so a value-only edit changes it with no text edit. Check the result in `shared/export/game-data.json` or on the data page.

## Targets

Some walks should fail: the road stays calm, so losing comes from bumps and choices, not from speed. A failed walk is one that ends before neighbourhood 4 because every owner fired you. The simulator measures each target per skill preset and card policy.

| Player  | Walks finished | Walks with a firing |
| ------- | -------------- | ------------------- |
| Novice  | 20 to 40%      | 75 to 95%           |
| Typical | 85 to 95%      | 10 to 25%           |
| Expert  | 95 to 100%     | 0 to 10%            |

- **Cards:** about 10 cards a walk at novice skill, more than one a minute; good dodgers meet fewer
- **Mild bonuses:** a gear item or upgrade card shifts earnings or the finish rate by about 10% at most. The Lucky collar and the Whistle, the two highest priced, are the exceptions: they may shift the finish rate more
- **Neighbourhood variety:** about 20 to 25 visual families per neighbourhood, aiming for 8 to 10 fixed obstacle types and 15 to 20 mover types; adjust roster counts where needed to fit the visual-family cap. The Beaches, the Distillery District and Yonge Street should have more distinct mover types than High Park, Cabbagetown and Kensington Market. Aim for movers to make up roughly 50 to 60% of obstacle spawns, with High Park near 50% and Yonge Street highest. Counts include the pull-only squirrel and exclude pickups and scenery; visual families combine width-only variants and types sharing the same sprite. Neighbourhood character and obstacle counts may vary within these guardrails
- **Play-style window:** for a given player, every pack of a given size, gear item and card policy lands within 10 points of the median finish rate and 15% of the median earnings. Picking the "wrong" dogs or gear makes a walk a little harder or easier, never a lot
- **Progression:** each extra dog raises a walk's earnings; about 45 to 55 walks buy every dog, slot and gear item (fewer for an expert); the Fanny pack and Hall pass pay for themselves within about 60 walks, Running shoes are bought for feel, and the Lucky collar and Whistle for safety
- **Trade-offs:** a strong downside always comes with a matching upside (Rush hour's extra tips come with more obstacles), and the net stays in the window
- **Walker spread:** every walker lands within the play-style window, and each, in unlock order (Casey, Mr. B, Ada, Trista), is slightly stronger than the one before: agility and perk make a walker feel different, never a lot easier or harder. The skill targets are for the median walker

## Release and tuning

**Walk target:** a walk lasts about 8 minutes, we want to play "one more", and it works by touch on a phone browser.

Version 1 is complete. Tuning continues against the targets above. The game is called Archie's Dog Walks.

Runtime generation targets 100% delivery: planner acceptance requires every plan complete using at most 75% of the per-attempt search allowance. The release floor stays an independently certified 90% of each neighbourhood's original active and auxiliary logical requests, allowing optional reward omissions under the [spawning rules](design.md#spawning-details).
