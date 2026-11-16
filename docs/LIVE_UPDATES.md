# Update content while players stay connected

The server accepts validated, data-only JSON bundles through a local operator command. It persists an accepted bundle before applying it, adds its actors to the running simulation, and sends definitions to connected clients before their next state update. New arrivals load the same definitions. Normal updates do not disconnect players or require a browser refresh.

Use this for dialogue, announcements, vendor stock, and **new** NPCs, enemy types, spawn points, quests, items and abilities. Editing a world source file still does not change a running server. Submit a bundle explicitly.

## Discover templates and browse assets

From the engine root, query the authored baseline without starting a server or building art:

```sh
npm run content:catalog -- --world minimal --section items
node tools/content-catalog.js --world minimal --section abilities --search strike
node tools/content-catalog.js --world minimal --section npcs
```

The command prints JSON with world/version/API, baseline hash and full matching definitions. Supported sections are `items`, `abilities`, `enemyTypes`, `npcs`, `quests`, `spawns`, `gatherables` and `assets`; omit `--section` for all. Search matches serialized definitions, case-insensitively. `abilities` includes cloneable class abilities only. `assets` reads a world's optional `shared/complete-assets.js` registry (empty for Meadow), includes dormant designs, and does not imply every art design has a gameplay template. Packs execute trusted code when inspected, just as when installed. This command never reads operator saves.

The catalog describes **source**, excluding accepted live additions. To discover the running revision and its additions, use `GET /live-content.json` and the operator's `--status`. Use source IDs for initial templates, then inspect accepted patches for subsequently added IDs. For worlds with an asset workshop, browse `/asset-library.html` on the running server or its built Pages preview; the engine does not require a world-specific workshop.

## Developer API contract

The supported write interface is `tools/live-update.js`, a local filesystem control plane, not a remote HTTP administration service. Developer tools can spawn it with an argument array and stream a JSON bundle on stdin. Use `--file` for reviewed files; check exit status and parse JSON stdout on success. Rejections are JSON receipts with `ok:false`, `status:"rejected"`, `revision` and `error`. Startup/CLI failures can instead write plain text to stderr. Never treat a timeout as rejection.

| Surface | Contract |
| --- | --- |
| `GET /live-content.json` | Public, read-only `{revision, patches}` snapshot with `Cache-Control: no-store`; no private saves or operator receipts. Not an asset registry or world baseline export. |
| `GET /ready` | Readiness and current `liveRevision`; storage failures return HTTP 503. |
| WebSocket `welcome.liveContent` | `{revision, patches}` used to catch changes since initial fetch. |
| WebSocket `contentUpdate` | `{type:"contentUpdate", revision, patch}`; apply the next revision before dependent actor snapshots. |
| CLI `--check` | Validate against the current baseline/revision; successful receipt has `status:"validated"` and leaves definitions unchanged. |
| CLI submission | Successful receipt has `status:"applied"` or `"already-applied"`, plus `ok:true` and `revision`. |

For a custom client, use `applyLiveSnapshot(snapshot)` and `prepareLivePatch(patch)` / `commitLivePatch(plan)` from `shared/live-content.js`, following the default client's ordering and revision guards. These modules bind to the assembled world's registries; import them from that runtime, not from an unassembled source tree. New browser tools should consume the existing read surfaces or the offline catalog. Remote write access would require a separate authenticated operator service; the engine currently provides no HTTP write endpoint.

The inbox envelope is internal to the CLI/server pair: `{baseContentHash, expectedRevision, check, patch}` in a UUID-named request, atomically renamed into `live-inbox/`. Build integrations around the CLI rather than hand-writing journal files. The wire shapes and filesystem format are experimental alpha contracts; pair tools with the same engine version.

## Try the included example

Start Meadow normally with `./start.sh`. In another terminal, from the engine root with Node.js 22+ on PATH:

```sh
node tools/live-update.js --data-dir data/minimal --status
node tools/live-update.js --data-dir data/minimal --file worlds/minimal/examples/live-update.json --check
node tools/live-update.js --data-dir data/minimal --file worlds/minimal/examples/live-update.json
```

If the launcher installed its own Node, use `.tools/node/bin/node` instead of `node`. Use your actual absolute `DATA_DIR` when running outside the engine directory. `--status` reads persisted status; it is not a server liveness check. Confirm `/ready` before submitting.

The example opens market day: two people and a practice slime appear near camp; vendors stock an additional tonic; Adventurers gain Market Strike in their spellbook and a quest from Market guide; Guide has new dialogue; connected players receive an announcement. Drag the new ability from the spellbook onto an action slot. The free example tonic is intended for demonstrating the workflow, not an economy recommendation.

The validator rejects the entire bundle if any part is invalid. `--check` validates against the running world's current revision and makes no changes. A successful check is not a reservation: the actual submission validates again. Successful application returns `{"ok":true,"status":"applied","revision":1}`. Repeating the identical bundle returns `already-applied` without duplicate NPCs, spawns or announcements. Reusing its id for different content is rejected; give each subsequent bundle a new stable id.

The command waits up to 15 seconds for a receipt. Exit codes are 0 for success, 1 for rejection/error and 2 for a timeout. **A timed-out request remains queued and may apply later.** Read the receipt path printed by the command before retrying. Request/receipt names identify individual submissions; the bundle's `id` identifies the content change.

## Docker Compose

The command is included in the game image. With the server running, stream the same file into it:

```sh
docker compose exec -T game node tools/live-update.js --data-dir /app/data/minimal --status
docker compose exec -T game node tools/live-update.js --data-dir /app/data/minimal --check < worlds/minimal/examples/live-update.json
docker compose exec -T game node tools/live-update.js --data-dir /app/data/minimal < worlds/minimal/examples/live-update.json
```

For Emberwild use `/app/data/emberwild` and a bundle with `"worldId":"emberwild"` and templates/coordinates from Emberwild. The Meadow example is deliberately rejected by Emberwild. These commands write to the existing save volume and work with the read-only container filesystem. There is no HTTP administration endpoint or browser admin token; filesystem/container access is the operator authorization boundary.

## Bundle format

See the complete working [Meadow bundle](../worlds/minimal/examples/live-update.json). Every bundle requires `id` and `worldId`. Other sections are optional; omitting a section leaves it unchanged. An announcement-only bundle is:

```json
{
  "id": "maintenance-notice-001",
  "worldId": "minimal",
  "announcements": ["A content update is arriving soon. You can keep playing."]
}
```

| Section | Shape and behavior |
| --- | --- |
| `items` | Map of new item ids to `{template, values}`. Clone an existing item, retain its equipment/consumable/art behavior, and customize supported values. |
| `abilities` | Map of new ability ids to `{template, values}`. Clone an existing class ability, retaining its class, effect mechanics and icon. Append to that class's spellbook without changing its original six skill roles or overwriting action slots. |
| `enemyTypes` | Map of new enemy ids to `{template, values}`. Retain the template's existing art/behavior; customize supported combat/reward values. This alone does not place a creature. |
| `npcs` | Array of `{id, template, x, z, values}`. Clone an existing NPC's appearance and basic role/services. Travel/inn registrations are not copied. New NPCs are stationary: existing patrol plans, authored topics and conditional greetings are not copied. |
| `spawns` | Array of `{id, type, x, z}`. Place a known/new enemy type immediately. Runtime actor ids are `live-mob-<id>`; ids remain stable on restart. |
| `quests` | Array of complete new quest definitions using the existing quest mechanics. References may point to additions in the same bundle. |
| `dialogue` | Map of NPC ids to `{greeting, reply}`. Replace default dialogue-window greeting and/or spoken/emote response text. Omitted fields retain prior overrides. |
| `questText` | Map of existing/new quest ids to any of `{title, objective, text, complete}`. Changes wording, not objectives, prerequisites or rewards. |
| `merchantStock` | Complete replacement array of item ids for the shared vendor catalog. Every item needs a nonnegative price. Removing an item from sale preserves the item definition and players' possessions. |
| `announcements` | Array of plain-text messages sent once to players connected when the bundle applies. Replays and retries do not resend them; these are not a persistent login bulletin. |

Supported `values` fields:

- Items: `name`, `description`, `icon`, `quality`, `power`, `armor`, `vitality`, `price`, `sell`, `minLevel`, `bagSlots`. New healing consumables use the existing 80-health tonic behavior and shared eight-second cooldown; use them from bags or bind them to the bar. Item icons/art reuse the template; `icon` is descriptive metadata.
- Abilities: `name`, `description`, `level`, `cost`, `cooldown`, `range`, `damage`, `heal`, `shield`, `castTime`, `radius`, `chain`, `slow`. The template must be a class ability, not return-home/travel. Required level cannot exceed the current cap. New classes, new effect implementations and changed class ownership require maintenance.
- Enemy types: `name`, `hp`, `damage`, `speed`, `xp`, `gold`, `loot`, `lootChance`, `respawn`, `level`, `aggro`, `color`. Existing engine behavior determines which authored fields apply; for example current corpse coins use the enemy level, and current respawn timing is engine-controlled. Adding a field does not implement a new mechanic.
- NPCs: `name`, `title`, `color` (numeric RGB), `facing` (radians), `lore`.

New quests support `kill`, `loot`, `gather`, `explore` and `skill`. Supply `id`, `title`, `objective`, `text`, `complete`, `giver`, `turnIn`, `kind` and the relevant `target` (or `location:{x,z}` for exploration). Exploration uses the existing four-pace proximity check. Optional fields are `count`, `xp`, `gold`, `reward`, `rewardCount`, `rewardsByClass`, `requires`, `minLevel`, `classId` and `dropItem`. Defaults: count/rewardCount/minLevel 1, xp/gold 0, prerequisites empty. Loot quests require `dropItem`; gather targets must already exist. Prerequisites must resolve without cycles. The existing world level cap stays in force.

Bundles cannot replace an existing item, ability, enemy, NPC, spawn or quest definition. Dialogue/quest wording and the vendor catalog are the explicit replacement exceptions. Ids must be stable alphanumeric strings with dashes/underscores, starting with a letter. Use plain text, not HTML. Unsupported fields, unknown references, invalid numbers, conflicting ids and placements outside walkable geometry are rejected. Placements must also make gameplay sense: validation does not measure balance, sightlines, player obstruction or appropriate quest pacing. Test on a disposable copy first.

Each bundle is limited to 128 KiB, arrays to 256 entries, the accumulated journal to 4 MiB, and total core registries to 20,000 entries. If concurrent submissions target the same revision, a stale submission is rejected; inspect the status and resubmit against the new revision.

## Persistence, backups and maintenance releases

The private world save directory contains:

- `live-content.json`: accepted bundles in order, with world id, baseline content hash and monotonic revision.
- `live-inbox/`: pending requests written atomically by the operator command.
- `live-receipts/`: success/rejection results for each request.

The server replays accepted bundles **before loading characters**, so inventory and quest references resolve on restart. New spawns are recreated once with their stable ids; transient combat, NPC and corpse state follows the normal restart behavior. Back up the **entire** save directory, including the live journal, using the normal stopped-server backup procedure. Do not restore characters independently of their corresponding content journal. Keep reviewed bundle files in the world's source repository as release inputs/examples; never publish save directories or receipts.

Accepted additions cannot be undone live. To correct text or stock, submit a new bundle. To remove content or change existing rules, schedule maintenance and prepare a migration for affected inventories, mail attachments, quest progress and positions.

A journal with additions is tied to the exact baseline world content hash. A different world build fails startup rather than silently replaying incompatible content. An empty journal can adopt a new baseline automatically. For a maintenance upgrade with existing live updates:

1. Stop and back up the complete save directory; keep the old engine/world artifacts too.
2. In a disposable copy, incorporate accepted additions and final dialogue/stock values into the new authored baseline, keeping stable ids and all saved references. Preserve NPC/spawn ids (including `live-mob-...`), and preserve ability class ownership and original role ordering.
3. Apply any explicit save migrations, and verify representative profiles, bank/mail items and quest progress against that baseline.
4. Archive the old journal and inbox/receipts **outside** the active data directory, then remove those active live-update files/directories only after their accepted content has been incorporated. Starting the new baseline creates a fresh journal. Do not merely edit its hash or delete it to bypass a startup error.
5. Verify readiness, clients and restore/rollback using the tested matching code/content/save combination before reopening.

This consolidation/migration is currently a deliberate maintenance task, not an automatic export-to-source feature. Rolling back to old code/content may require the corresponding old saves; preserve the newer backup separately.

## Client and operational contract

The default client fetches `/live-content.json` before initialization, synchronizes again from the welcome message, and applies each `contentUpdate` before rendering subsequent snapshots. Open dialogue, vendor, journal and spellbook windows refresh. A world replacing the default entry must implement this protocol using `shared/live-content.js`; CSS themes and ordinary UI extensions inherit it automatically. Baseline hashes remain fixed; live revisions are tracked separately and appear in `/ready` and the debug view. Missing/out-of-order revisions require a reload instead of guessing at definitions. Severely backlogged sockets may be disconnected to resynchronize safely.

The current server still has one simulation/store writer per world directory. This feature does not add zone workers, change geometry, reload JavaScript, or make JSON storage safe for multiple writers. Polling is every half second; validation/file I/O and definition application are suitable for small bundles, not bulk map streaming. Test substantial updates for tick latency before applying them to a populated server.

For a larger world using shipped dormant art templates, see [the Emberwild example](EXAMPLES.md) and its own live authoring guide.
