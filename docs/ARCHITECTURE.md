# Architecture and scaling boundaries

The launcher combines core `server/`, `shared/` and `client/` modules with exactly one world package. Engine-owned files cannot be overridden by a pack. Runtime assembly happens in a disposable `.runtime/` directory; player data lives outside it. The development assembly can additionally include world tests, authoring files and tools. Public HTTP serving is restricted to the selected client/shared/vendor roots.

`server/index.js` owns HTTP, WebSocket sessions and the tick/send/save loops. `server/world.js` owns authoritative positions, combat, inventory, quests and actor state. Browser clients send intentions. The default browser entry, controls, windows, roster/customization, HUD, chat/social interfaces, inventory/equipment, spellbook, atlas, settings and scene interaction code live in the engine and are used by both worlds. `shared/movement.js` and world-supplied terrain/collision run in prediction and authority. `client/netcode.js` provides prediction/replay and remote interpolation. World-specific scenery and creature rendering are supplied by `client/world-presentation.js`; race-specific geometry/palette hooks are in `client/race-appearance.js`. Generic avatars, animation and equipment remain shared. Game UI text/identity descriptions are in `world-ui.js`. Optional manifest client hooks customize styles, extend shared behavior or replace the entry point entirely.

`shared/inventory-rules.js`, `shared/quest-rules.js` and `shared/collision.js` provide common behavior with world definitions as inputs. Specialized terrain, authored story/social reactions, maps, art recipes and rule adapters belong to the pack. The API still has original RPG-specific conventions; see [world packages](WORLDS.md).

The simulation ticks at 20 Hz and sends snapshots at 10 Hz. Emberwild's region ownership/indexing reduces unrelated actor replication and sleeps some offscreen work. All regions still share one process/world clock and a global capacity limit. The minimal pack uses one region. There are no independent zone-worker processes or distributed handoffs.

`CharacterStore` serializes transactions through one in-process queue and atomically replaces a JSON document. Rosters, character profiles and mail escrow share that transaction boundary. Normal progress is saved every ten seconds and on disconnect/logout/shutdown. This is single-writer storage, with potential loss since the last successful save on abrupt failure. It is not a transactional database, distributed mutex or durable event log.

## Live content updates

`shared/live-content.js` validates data-only additive bundles and mutates registry objects in place so simulation/client rule closures see the same additions. `server/live-updates.js` serializes local operator submissions, persists the accepted journal before mutation and replays it before loading characters. The default client bootstraps and synchronizes the overlay before using new actor/state definitions. The journal is tied to a world baseline hash; this does not replace geometry or code and does not provide distributed ownership. See [live update operations and schema](LIVE_UPDATES.md).

## Intended service evolution

| Stage | Deployable units | Additional contracts needed |
| --- | --- | --- |
| Current | One game runtime; external optional edge proxy | Operational limits, metrics, backup/restore and soak validation |
| Durable backend | Game runtime + transactional database | Repository interface, schema/content migrations, atomic inventory/mail operations |
| Independent realms | Allocation/session backend + multiple world runtimes + database | Realm identity, routing, exclusive character leases, disconnect/reconnect recovery |
| Independent zones | Gateway/control plane + zone workers + global services | Single-authority leases/fencing, transfer protocol, idempotency, failed-handoff recovery |

Keep movement/combat/AI and local item/quest changes together inside a simulation worker. Extract account/session management and durable persistence first. Presence, parties, chat and mail can become global services when multiple workers require them. Preserve atomic mail attachment/escrow guarantees across those changes. A broker or Redis can support presence/event routing later; neither replaces authoritative durable character storage.

Measure simulation tick duration, event-loop delay, snapshot bytes, outbound bandwidth, save latency, event fan-out and boundary-crossing churn before selecting scaling limits. Define target concurrency and recovery behavior before implementing autoscaling. An orchestrator can schedule containers but cannot invent world ownership or move a live authoritative simulation safely.
