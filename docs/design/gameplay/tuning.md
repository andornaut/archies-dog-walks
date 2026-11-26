# Tuning

Balance targets for the current rules. [Tuning data](../../../src/data/tuning.ts) holds the configured values, and [world data](../../../src/data/world.ts) holds neighbourhood pools and weights.

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

## Playtesting

- **Playtesting:** the user playtests on devices. Run a bounded simulation batch only for a specific gameplay question that unit tests cannot answer.

## Release and tuning

**Walk target** is about nine minutes for the full walk, including about eight minutes of active walking plus cards, hit stops and celebrations. A finished walk should make players want to play again.

The version 1 design is complete. Tuning continues against the targets above.

Runtime generation targets 100% delivery: planner acceptance requires every plan complete within 75% of the per-attempt search allowance. The [planner contract](../../planner-work.md#contract) holds the release floor and the omission rules.
