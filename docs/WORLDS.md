# World packages and authoring

A world is an independently versioned directory containing `world.json`, content/rule modules, authored scenery and race/UI adapters. By default it uses the engine's shared browser entry point and complete interface. The engine assembles its reusable modules and exactly one selected world in an ignored `.runtime/` directory. Public URLs and server imports resolve to the same assembled definitions, including collision used in prediction. No custom Node loader, source-file rewriting or installation into engine source is required.

## Make your first world

1. Copy the included example:

   ```sh
   mkdir -p worlds/local
   cp -R worlds/minimal worlds/local/my-world
   ```

   On Windows, copy the folder in File Explorer. `worlds/local/` is ignored so your game can have its own repository.

2. Edit `worlds/local/my-world/world.json`:

   ```json
   {
     "id": "my-world",
     "name": "My First World",
     "version": "0.1.0-alpha.2",
     "runtimeApi": 1,
     "license": "MIT",
     "levelCap": 3,
     "zoneNames": {"meadow": "My Meadow"}
   }
   ```

   Use a new stable `id` for a different game. The id selects both the default save directory and browser access-key namespace. Choose an appropriate license for your own work and include its license text. Reusing an id means you intend to continue the same world and saves.

   An optional `storagePrefix` preserves older browser keys. Emberwild uses `emberwild` for that reason. When making a different game from that pack, remove or change the prefix as well as changing its id; the supplied interfaces honor the configured namespace.

3. Edit `shared/data.json` in your copied pack. Change `zone.name`, NPC names and dialogue, quest text, coordinates, item names or creature stats. The minimal example keeps all ordinary playable definitions in this file. For a first change, rename Guide and the first quest, move the blue-marker objective's `location`, and update the marker placement in `client/world-presentation.js` to match. The sample's decorative blue marker is presentation code, while the actual objective is authoritative data.

4. Validate and launch:

   ```sh
   npm run world:check -- --world ./worlds/local/my-world
   npm start -- --world ./worlds/local/my-world
   ```

   Open http://localhost:3080. Your new display name and definitions load without changing engine files. Its saves go to `data/my-world/`. Stop the server and launch again after source edits; the assembled runtime is a startup snapshot.

5. Run and extend the example's campaign tests:

   ```sh
   npm run test:world -- --world ./worlds/local/my-world
   ```

   The inherited tests refer to the example's quest/item ids. Update them when you change those ids or the adventure. Packaging checks and tests never certify third-party code as safe.

6. Build a separate world archive and a combined starter:

   ```sh
   npm run package:release -- --world ./worlds/local/my-world
   ```

## Ordinary content definitions

`shared/data.json` defines the sample's zone/spawn, XP thresholds, items, classes, races, skills, NPCs, quests, enemy types/spawns, gathering, merchant stock, landmarks and collision boxes. `shared/definition.js` reads those same bytes in Node and in the browser. World modules adapt the definitions to the runtime API.

A quest has a stable `id`, `title`, `giver`, `turnIn`, `kind`, `target`, positive `count`, `xp`, `gold`, `minLevel`, `requires` array, `text`, `objective`, `complete`, and `rewardCount` (normally 1). Optional `reward` references an item. An exploration quest includes a `location` with `x` and `z`; kill/loot targets name an enemy type; gathering targets name a gatherable type. The guide's three quests are complete examples. Prerequisites name other quest ids.

Items declare a name, rarity (`quality`), description and optional price/sell value. Equipment additionally has a slot and optional stats/appearance recipe. NPCs have stable ids, positions and service/role information; quests reference their ids. Spawns reference enemy-type keys. Gathering resource definitions reference inventory item keys. `world:check` checks references, ids, spawn walkability, reward fields, XP thresholds, classes and a simulation/snapshot smoke check.

World coordinates use metres, +Y up, with ground movement on X/Z. `shared/terrain.js` supplies height; `shared/props.js` supplies collision through the engine's `createCollisionWorld`. The minimal crate demonstrates geometry that both prediction and the server enforce. Visual decoration is not automatically physical: render collision boxes, or explicitly register matching collision for new solid objects.

## Runtime API 1

The full client is shared by both Meadow and Emberwild; games customize it through [client customization](CLIENT_CUSTOMIZATION.md), including a theme, extension or complete client entry replacement. Emberwild's four other races and their appearance code/sprites stay in its world package. Meadow includes only Human and its own Harefolk race, with Adventurer and Scholar classes.

Required world modules are listed in `tools/worlds.js`. The engine reserves all files it owns and refuses a pack that replaces one. A world supplies new files in these namespaces:

| Namespace | Purpose |
| --- | --- |
| `shared/` | Content, rules adapters, movement geometry, services, visibility and public definitions |
| `server/npc-dialogue.js` | Authored speech and the `npcReaction` server hook |
| `client/world-presentation.js`, `world-ui.js`, `race-appearance.js` | Authored scenery, UI text and race art used by the shared client |

Shared and client files are browser-readable. Put secrets and private operator configuration elsewhere. Only selected static client/shared/vendor roots are served. `docs/`, `game-data/`, tests and server source are not public HTTP routes.

The initial interfaces retain several RPG conventions from the original game: six class-skill roles (primary/ranged/heal/area/utility/advanced), the `potion` healing-item command, humanoid/equipment recipes, and optional conversation/routine modules with historical names (`capital-story.js`, `city-routines.js`). The minimal world supplies empty adapters for unused systems. Its two classes use all six skill roles; race/class metadata drives the shared picker and skill books. Race definitions may supply `preview` camera framing and `nameplateHeight` for different silhouettes. These are alpha contracts, not a promise of a general-purpose engine API. Emberwild still authors much of its content and specialized geometry as trusted JavaScript; converting all of it to JSON is future work.

Reusable core factories cover inventory (`shared/inventory-rules.js`), quests (`shared/quest-rules.js`) and collision (`shared/collision.js`). The two packs use these same implementations. World-specific quest views, authored social rewards and geography belong to the world package.

The engine generates `shared/world-info.js` with public identity/version/hash information. Do not include that file in a pack. The supplied clients send world identity and a content hash on join so a page loaded before a content update is asked to reload. Legacy development clients may omit these optional fields.

## Versioning and saved characters

`runtimeApi` is checked before running a pack; unsupported APIs are refused. `version` is a semantic content version. Use stable quest/item/character ids within one world. Saves record `worldId` and `contentVersion`, and the save directory has a world marker. Switching the same save directory to another world is refused.

Content versions are recorded, but there is not yet a general content migration engine. Before changing definitions used by existing saves, back up the data, write/test any required migration, and verify resume with representative characters. Changing the manifest version alone does not migrate removed items, objectives or geography. Existing Emberwild layout migrations remain in that pack.

## Installing and trusting external packs

Extract a world archive beneath `worlds/` or pass its absolute directory with `--world`. The operator must trust the source: world modules execute as server/browser code with the server's access rights. The pack validator catches structural errors, incompatible APIs, engine replacement and symbolic links; it is not a JavaScript sandbox.

The engine repository includes only the minimal pack. Emberwild has a separate repository and separate release archive, and is intentionally ignored by the parent repository. Other worlds can use the same pattern without being added to engine history.

### Optional self-service inn hearths

A world's `shared/travel.js` may mark an available `WAYPOINTS` entry with
`selfService: true`. Supply a stable `id`, `name`, `mapId`, and clear `x`/`z`
arrival point. The Travel window offers binding when the character stands
within 4.8 metres; the server checks distance, line of sight, grounded/alive
state, combat and casting before accepting `{type:'waypoint', waypointId}`.
NPC-hosted entries continue to bind with `npcId` and require an innkeeper with
the waypoint service. Binding an inn does not unlock flight routes or bypass
Hearthward Return's cooldown. Keep future NPCs and props clear of the hearth.

Flight nodes can optionally include `innId` to identify a paired inn. Add an
edge connecting that node to the main network; discovery remains per character
and requires a ground visit. Atlas charts may provide `services` entries with
paper-space `x`, `y` and `type: 'inn' | 'flight' | 'capital'` for persistent
service badges. The minimap's flight/capital toggle uses `TRAVEL_NODES`.
