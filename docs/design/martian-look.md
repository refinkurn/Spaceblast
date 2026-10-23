# Martians and bosses: low-poly look

Decided by Refindo on 2026-10-24 and built the same day. View only, built in code (`src/view/martian_mesh.ts`, `src/view/boss_mesh.ts`). Each species keeps its gameplay colour from `src/view/play_colors.ts`.

## Martians
| Species | Look | Motion |
|---|---|---|
| Goopling | a jelly "space octopus": low dome, a darker rim, six stubby tentacles splayed out, big eyes | the jelly wobbles; tentacles wiggle, faster while crawling |
| Sniffer | low and lean on four thin legs, a long snout with a dark nose, two feelers with round tips | snout twitches, feelers wave; legs step in diagonal pairs while moving |
| Phaser | a floating see-through jellyfish hood, a pale glowing ring, five trailing tentacles | hovers, the ring spins, tentacles sway; its burrow swirl is unchanged |
| Builder | a stocky crab: a wide shell with rocky plates, two big claws, six legs, a toxic green drip | legs scuttle while moving; claws slap up when it builds a rock (`rock_built`) |

- In a Blackout only the eyes give a Martian away.
- When frozen, they turn icy blue and stop moving.

## Bosses (on the centre tile, about 1.5 tiles across)
- **Goopling Hive:** a lumpy green organic mound with pulsing pores and one big eye.
- **Darkness Hive:** bigger and darker, violet jagged crystal with spikes and crackling arcs that flicker, more often during a wave warning.
- **Maze Master:** a floating orange crystal core over a stone base, with four stone blocks orbiting it. During a warning they stop and lock onto the cross axes of its cross blast, then push out.

All three breathe and pulse, faster and brighter while a wave is announced.

## Not changed
The 2D silhouettes on the alien intro cards (`alien_cards.ts`) are unchanged; they can follow later.
