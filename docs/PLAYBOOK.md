# Playbook: where to put what

Refindo decides. Story/design chat specs and queues. The build agent builds. Read `docs/HANDOFF.md` to see the state of everything.

## The rule of thumb

| You want to... | Go to | Say this |
|---|---|---|
| Decide, plan, change the story, write a spec | **Chat** (Space Blast Project) | the idea, in plain words |
| Build a queued item right now | **Code session** | `pull and take the next item` |
| Fix something urgent, small and obvious | **Code session** | what is wrong + where you saw it |
| Fix a hard bug in rules or online play | **Code session** | `use sim-specialist: <bug>` |
| Know what is happening | **docs/HANDOFF.md** | nothing, just read it |

Nothing is built unless it is in Ready. The nightly run (01:52 Jakarta time) takes up to 4 Ready items from the top, one at a time, builds them if they are text, UI, input, assets or tests, and stops if the queue is empty or an item gets Blocked.

## Writing a good Ready item

One item, one result. Copy this:

```
- **<what>** (<file or screen>)
  Now: <what happens today>
  Want: <what should happen>
  Done when: <how to check it, e.g. "level 3 card shows the new line">
  Spec: docs/design/<file>.md   (only if there is one)
```

Small and specific items finish in one run. If an item has more than three "Want" lines, split it.

## Playbooks

### Finish the creative assets

Assets are data, so no code changes. Folders live in `src/assets/characters/<id>/` (see the README there).

1. Make or approve the art outside the game (the character pack, `claude/character-assets-handoff.md`).
2. Hand it to the chat: drop the PNG atlas + JSON in the chat, or put them in a branch or folder in the repo.
3. Chat checks the file against the rules (128x128 cells, pivot, 16 colours, indexed PNG, atlas under 1024 px) and queues: `Wire <character> atlas into src/assets/characters/<id>/ and map poses in character.json`.
4. The build agent copies the files, edits `character.json`, runs the tests (they check every pose used in a scene exists), and ships.

Current to-do for art (from the handoff):
- Ducking: only idle is on the new design. Walk, attack, shocked, angry, hit, KO, victory and 3 portraits are still old art.
- Capybara, Goopling Hive, Darkness Hive, Maze Master: only placeholders (`character.json`, no art yet).
- Scale: Ducking reads smaller than Bosco. Portrait pixel density differs between characters.
- Kit: the "worried" eyes and the "relieved" wink need a pass.

### Fix a bug

1. Note what you saw: screen or level, what you did, what happened, what should have happened. A phone model helps for visual bugs.
2. If it is UI, text or an asset: tell the chat, and I queue it as a Ready item. Or tell the code session directly if it is tiny.
3. If it touches rules (`src/sim/`), online (`src/net/`, `server/`) or "it only happens online": tell the code session, `use sim-specialist: <bug>`. These are never run by the nightly job. They wait for you.
4. Done when `npm test` passes and the build agent reports what changed.

### Fix or change the UI

1. Describe the screen and what is wrong, with a screenshot if you can (menu, level card, cutscene, HUD).
2. Chat writes a short spec in `docs/design/` when the change is bigger than a tweak, then queues it.
3. Menu: `src/flow/menu.ts`. Story scenes: `src/flow/cutscene.ts`. Level card, HUD: `src/flow/hud.ts` and `src/flow/intro_card.ts`.
4. Check on your phone: `npm run dev` is reachable on the same Wi-Fi. Buttons must stay at least 48 px.

### Change story text

Say it in the chat. Say the line, or the idea. I check it against the game's rules (bosses can't be destroyed, Kit is radio only, and so on), queue it, and the `script-integrator` agent applies it.

### Something new (a feature)

Chat first: I ask the questions, write the spec to `docs/design/`, and split it into Ready items. If it touches the rules, it goes to the code session for you to watch, not the nightly run.

## Keeping usage low

- Decide in the chat, build in the code session. Do not discuss design inside a build session.
- One topic per code session. Start a fresh session when a batch is done. It starts light and on Sonnet.
- Ask for results, not explanations: "queue it" is cheaper than "explain how you would".
- Check `docs/HANDOFF.md` instead of asking where things stand.
- Use Opus only for rules and online bugs.
- If a push notification says an item was Blocked, answer the question in the chat. The next run picks it up.

## Never automatic

- Anything in `src/sim/`, `src/net/`, `server/`: waits for you.
- Anything that changes the rules numbers in CLAUDE.md.
- Deleting files or changing the build setup.
