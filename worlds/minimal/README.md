# Meadow Sample

A compact MIT-licensed game included with KithCore. It demonstrates the same authoritative server, prediction, inventory, quests, collision and persistence used by independently packaged larger worlds.

From the engine root, run `./start.sh` or `npm start -- --world minimal`. Open http://localhost:3080, speak to Guide, and follow the blue marker. Three introductory quests teach exploration, combat and gathering. Two short breadcrumb quests then take you to Willow rest and Ridgewatch camp; the level cap remains 3.

`shared/data.json` contains ordinary authored definitions. `shared/` adapters supply the runtime API; `client/` supplies scenery, race art, theme and a sample UI extension; the full default interface lives in the engine. `server/npc-dialogue.js` supplies authored speech. Humans and Harefolk can both train as Adventurers or Scholars. All four combinations have campaign/persistence coverage. A banker, mailbox, readable book and bag vendor demonstrate the shared interfaces. No Emberwild files, story, maps or exported assets are required. See the engine's `docs/WORLDS.md` to copy and customize this pack.

From the engine root, `npm run test:minimal` runs its campaign/collision checks and `npm run test:browser` runs the isolated two-browser smoke workflow.

The vale is 160 × 160 metres with five distinct landscape regions on one seamless map:

| Region | Character | Hub or nearby objective area |
| --- | --- | --- |
| Meadow Commons | Gentle central grassland; original tutorial preserved | Meadow camp, blue practice marker, starter slimes |
| Willow Grove | Raised woodland to the west | Willow rest, herb clearing to its northwest |
| Sunrise Ridge | Broad climb to a roughly 14-metre northern upland | Ridgewatch camp, practice slimes around the cairns |
| Old Chalk Quarry | Pale rocky eastern slopes | Abandoned chalk yard and practice slimes |
| Reedwater Hollows | Low southern reed beds and shallow decorative pools | Herb patches and a practice slime |

The three hubs offer return binding and mail; camp retains the vendor and banker. The two new quests only ask you to visit and greet the next hub. The remote objective areas are deliberately available for free exploration and future authoring rather than another quest chain. No new enemy types, class abilities or item progression are required. Pools are scenery, not a swimming mechanic.

`shared/landscape.js` owns region boundaries, continuous height, hubs and trail paths. The server and browser use the same terrain height; ground meshes, scenery and interaction objects follow it. Both the atlas and local map show the expanded layout. Landscape regions share one simulation and interest set; they are not independently deployable zones. Layout revision 2 retains valid old positions and resettles saved characters onto the new surface. This terrain/layout change requires restarting a running world; the additive live-update inbox does not change terrain.
