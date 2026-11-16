# Customize the client for your game

Meadow and Emberwild use the same default interface. The engine owns the roster/customization screen, input/camera, prediction, targeting, HUD, nameplates, draggable windows, action bars, bags/equipment, dialogue/journal, maps, settings, parties, friends, chat and mail UI. A small game needs less content; it does not need a separate reduced interface.

World packages own these customization points:

| File or setting | Purpose |
| --- | --- |
| `client/world-ui.js` | Branding, region/home names, identity descriptions, empty journal guidance and NPC greeting rules |
| `client/world-presentation.js` | Terrain/scenery, interactable meshes, creature art/animation, map background and world visual updates |
| `client/race-appearance.js` | `racePalette(id,palette)` and `addRaceTraits(rig,id,palette)` cosmetic hooks |
| `client/world-icons.svg` | Additional sprite symbols merged into the runtime's `/icons.svg`; engine source is not modified |
| `world.json` → `client.stylesheet` | A game-owned stylesheet layered after the shared styles |
| `world.json` → `client.extension` | A game-owned module exporting `setup(context)` after default client initialization |
| `world.json` → `client.entry` | Optional complete replacement client module |

## Theme and extend the default interface

The included Meadow manifest demonstrates two hooks:

```json
"client": {
  "stylesheet": "/meadow-theme.css",
  "extension": "/meadow-ui.js"
}
```

These URLs resolve to the selected pack's `client/` directory. Paths must be local absolute URLs ending in `.css` or `.js`, without traversal or an external origin. Missing files are rejected by package loading. World code remains trusted code, not a sandboxed upload.

A theme can set shared variables such as `--gold`, `--green`, `--panel`, `--line` and `--muted`, and override layout/typography selectors. The root document also has `data-world="<world-id>"` for scoped styles. Meadow's small theme changes its heading/accents while preserving the established controls.

An extension receives `{ui, scene, roster, preferences, send}` from the shared client. It can add buttons or windows, specialize help, change layout, wrap UI methods, or add game-specific behavior. `client/meadow-ui.js` is a working example: it wraps the shared help window to add local service instructions. Keep server-owned capabilities authoritative; `send` sends intentions, not privileged state changes. These alpha JavaScript interfaces may change as the client contract matures.

The shared client's element IDs, classes and exported objects are available to extensions. Changes to core default behavior should be tested in both worlds. Keep game-specific wording/scenery out of shared modules.

## Branding and identity

`WORLD_INFO.name`, level cap and zone labels come from the manifest. `world-ui.js` exports `UI_CONFIG`, `raceTraits`, `classStories`, `trackerEmpty(player)`, `npcGreeting(player,npc)` and `showQuestRing(player)`. `UI_CONFIG` covers tagline, region, home, people label, entry label, welcome text, lobby camera focus, quest-ring position and optional per-zone display labels.

The race/class picker and skill book read the selected world's `RACES`, `CLASSES` and `CLASS_SKILLS`. No engine edits are needed for new IDs. Define `race-<id>` and `class-<id>` symbols in your world sprite. Human's default portrait is shared. Identity descriptions can use the world UI adapter's rich story fields; otherwise the picker falls back to the class/race definition.

Meadow defines Human/Harefolk and Adventurer/Scholar. Both races can choose either class; race changes appearance, while class sets stats, skills, armor training and starter equipment. The classes demonstrate different weapons, melee/ranged play and class-specific quest rewards. The sample keeps six skill roles, with action keys 1/2/3/4/7/8 reserving slots 5/6 for tonic and auto-attack.

Race art receives the common humanoid rig and can add meshes without changing its animation/equipment sockets. Optional race `preview` fields (`bodyFocus`, `bodyDistance`, `faceFocus`, `faceDistance`) frame different silhouettes. `nameplateHeight` keeps labels above taller features. These are cosmetic settings; collision remains the shared character capsule unless your rules deliberately change it. Emberwild's Sylvren, Cairnkin, Brinefolk and Emberkin registries, descriptions, sprites and trait meshes live only in Emberwild.

## Replace the complete interface

Set `client.entry` to a new game-owned JavaScript module, for example `/custom-client.js`. The bootstrap loads it instead of `/main.js`; that module owns client initialization and may replace the default DOM shell. You can reuse shared rendering/network/rules modules or build another presentation against the server protocol. An extension, if also configured, receives that entry module's exports.

Do not copy files over engine-owned `main.js`, `index.html` or other shared modules. The pack loader rejects collisions. A distinct entry filename is the supported replacement boundary. The default client stays fully usable without an extension or extra stylesheet.

## Persistence and testing

World identity and browser storage prefixes remain separate from the theme. Do not change an existing game's storage prefix when restyling it. The shared roster imports the earlier Meadow client's raw account-key format and preserves Emberwild's historical JSON/key names.

Run `npm test`, `npm run test:minimal` and `npm run test:browser` after changes. Meadow's browser workflow verifies every race/class preview plus the shared windows, settings, world UI extension, multiplayer, quests, movement, chat and save/resume. With Emberwild installed, also run its relevant regression/browser workflows so changes remain compatible with the larger demo.

## Live definitions

Themes and extensions inherit default-client live updates. A replacement entry must fetch `/live-content.json` before using definitions, apply `welcome.liveContent` before character initialization, and apply ordered `contentUpdate` bundles before subsequent snapshots. Use `applyLiveSnapshot`, `prepareLivePatch` and `commitLivePatch` from `shared/live-content.js`; refresh any cached menus/catalogs after application. Reload if revision/history checks fail. See [the complete operator and protocol guide](LIVE_UPDATES.md).
