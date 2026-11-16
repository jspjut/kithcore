# Alpha release preparation

The first implementation milestone separates reusable runtime code, an included small game and the existing Emberwild world. Local packaging and deployment workflows are in place; the remaining publication gates are tracked in [the open-source release checklist](OPEN_SOURCE_RELEASE.md).

Implemented in this milestone:

- Independent world manifests, runtime API checks, content hashes and source composition without replacing engine-owned files.
- A small playable JSON-authored example using the existing authoritative simulation and shared inventory, quest, movement and collision implementations.
- A separate Emberwild source/content package, retaining its procedural art, story and regression workflows while using the shared client.
- World-specific save paths, explicit legacy adoption, world identity checks and content-version metadata.
- Versioned engine/world/starter archives with payload/archive checksums and private-data exclusions.
- Container/Compose configuration, read-only content/root filesystem, readiness checks and persistent storage.
- Quick starts, authoring/deployment/contribution instructions and CI definitions.

Remaining before a public alpha:

- Independent clean-machine onboarding and broader Windows/macOS/browser verification; run the new hosted CI after repository publication is configured.
- Human playtesting of both experiences, pacing, accessibility and hardware performance; sustained load/soak and failure-recovery tests.
- Finish consolidating Emberwild's older historical design notes and verify the full asset preview/export workflow on clean machines.
- Broader content validation (including prerequisite cycles, reward budgets, routes and schema migration) and a declared compatibility/support policy.
- Repository/dependency/security/provenance review, private vulnerability contact and maintainer approval of the prepared release notes.
- Durable transactional storage and production account/abuse controls if the release is to include a public hosted service.

The alpha source release does not require independent zone workers. Transactional persistence, realm allocation and seamless distributed zone ownership remain later infrastructure milestones. The current runtime and JSON store require a single writer per world save directory.

## Local verification

On the development Linux environment, the extraction passed the 240-test Emberwild regression suite, six engine/packaging/isolation checks and the two-test minimal campaign/collision suite. The minimal game passed a real two-browser workflow (rendering, shared players, movement, quests, chat and save/resume), including against the restricted Docker Compose deployment. Emberwild's city-life browser workflow passed zone crossing, actor continuity, moving NPCs and live vendor interaction without page/shader errors. Its asset build and separate asset ZIP were rebuilt through the relocated authoring tools.

These checks are development evidence. Hosted CI, broader platform coverage, sustained load, operational restore drills and independent human onboarding/playtests remain release gates.

Clean archive extractions were installed with fresh production dependencies and launched through `./start.sh`: the base engine ran without Emberwild, a world-only download installed into it independently, the starter selected Emberwild by default, and a character survived a stop/restart. Existing local Emberwild saves were separately copied into its world-specific directory and all eight profiles/two rosters were preserved unchanged on initial restart.

The documented Docker backup/restore procedure was exercised with disposable saves: two profiles and two identities survived restart and restored byte-for-byte into a fresh named volume using the game image. Both the base image and separately mounted Emberwild demo deployment became healthy under the restricted Compose configuration.

## Shared client milestone (alpha.2)

Both worlds now run the same full client, including roster/customization, control/camera handling, nameplates, targeting, casting, action bars, inventory/equipment, quest windows, atlas/minimap, settings, social and correspondence interfaces. World modules own scenery, race appearance, authored UI text and extra sprites. Optional manifest fields select a theme, `setup(context)` extension or a complete replacement entry point.

Meadow has Human and Harefolk races and Adventurer and Scholar classes. All four combinations complete the campaign and restore their identity/class rewards. Its banker, post, bag vendor and readable book provide a small example of the shared UX. Emberwild retains its four other races exclusively in its pack. Saved world ids and existing class ids are preserved, and the shared roster accepts the old Meadow browser-key format.

The previous alpha.1 client-module layout was experimental. Packs moving to this client supply `world-presentation.js`, `world-ui.js` and `race-appearance.js`, rather than replacing the engine's `index.html`, `main.js` or UI modules. An optional `client.entry` is the supported way to replace the complete interface.

The refactor passed seven engine/packaging/isolation checks, five Meadow campaign/collision checks and the 240-test Emberwild regression suite. The shared-client browser workflow covered all four Meadow previews, full shared windows/settings, its custom help extension, multiplayer, movement, chat, quest acceptance, logout/resume and the older raw browser account format. Emberwild's identity workflow verified its five races, four classes, sixteen valid combinations, keyboard controls, compact viewport and saved identity; its city-life workflow also passed. These Firefox/software-rendering checks reported no page or shader errors.

## Live content milestone (alpha.3)

Operators can validate and submit persistent data-only bundles while players stay connected. Supported changes are dialogue/quest wording, announcements, shared vendor stock and additive NPCs, enemy types/spawns, quests, items and abilities using existing mechanics/art. The engine provides atomic journal replacement, baseline/revision checks, receipts, idempotent retry, restart replay and client synchronization. The included market-day bundle and [operator guide](LIVE_UPDATES.md) cover Node and read-only Docker deployments. Removals, geometry/code changes and incompatible edits remain maintenance operations.

Local verification passed ten engine/packaging/isolation/live-update tests, five Meadow campaign/collision tests and 240 Emberwild regressions. Tests cover rejected bundles without mutation, failed journal writes, stale submissions, new-item use, ability/quest progression, live sessions, retry, restart and incompatible baselines. Real Firefox workflows in both worlds rendered new actors, refreshed open dialogue/vendor windows, exercised new quests/abilities, announcements, new arrivals and reloads without page/shader errors; the standard Meadow browser workflow also passed. The Compose stdin command validated/applied the sample bundle and retained its revision and actors after restart. These checks do not replace the independent onboarding, playtesting and load/recovery release gates above.

## Source-only automation and websites

Both repositories have staged/working-file source guards and opt-in local hooks, plus CI checks. The complete Emberwild generator library is retained; a single command regenerates every curated model and thumbnail and validates exports. Game releases exclude nested archives and may include a separate complete art tarball. Each project has static Pages source with three interactive scenes and four focused build-recorded demo clips; Emberwild includes the complete workshop. Workflows upload generated artifacts without committing them, gate Pages deployment to enabled/default-branch runs and create draft prereleases from matching tags. Public repository configuration, the world’s tested engine commit pin and hosted workflow execution are still pending; see [setup](BUILD_AND_PAGES.md).

Local verification for this milestone: 14 engine/policy/packaging checks passed; all six asset checks passed after rebuilding from only Git-indexed world source; both generated sites passed project-prefix/mobile/rendering checks and played its recorded videos. The static Emberwild workshop retained its complete catalog and successfully exported a model. Real release tarballs retained all generator modules plus all 131 model exports/131 previews in the optional art artifact, with no nested ZIP or generated site included. Hosted workflows have not run yet.

## Focused website demos

The engine landing page is presented as KithCore and highlights reusable server/client capabilities, with Meadow as an example package. Each site now generates four focused recordings: race/class/appearance customization, a moving world flyby, server-authoritative combat followed by looting, and an authored two-NPC speech/emote exchange. Demo staging exists only in disposable build runtimes; verified outcomes are recorded in the generated media manifest. Videos use muted looping autoplay, pause offscreen/when hidden, and provide native/global pause controls and reduced-motion behavior.

## Meadow vale expansion

The included sample now has five landscape regions within a 160 × 160 metre seamless map, with a gentle northern ridge, western woodland, eastern quarry and southern hollows around the original commons. Three rest stops have mail and return binding. The three introductory quests remain; only two hub-to-hub exploration breadcrumbs were added. Shared terrain drives both movement and scenery, and the atlas, minimap, help text and engine website views use the expanded layout. Meadow's README describes the regions and authoring inputs. Layout revision 2 retains valid existing positions and resettles characters on the new terrain after a restart.

Verification covers all four race/class tutorial paths, walking every authored trail in both directions, both breadcrumb turn-ins, and save restoration at altitude. The engine's 16 tests and the two-browser Meadow workflow also pass. Browser rendering on this development host uses the available virtual display with software OpenGL; player hardware performance and human playtesting remain part of release review.

## Emberwild continent geometry

Emberwild now allocates 37 leveling zones, five capitals and ten distinct level-100 frontiers with four connected leveling routes. Existing campaigns remain populated; new regions supply static geography, unoccupied cities and future encounter spaces. The live cap remains 10. Character-owned flight discoveries and capital portals persist; flights use an actual skyway skiff and interrupted journeys save safely at departure. The complete source art library now has 174 designs, 15 palettes and eight assembled sets, with 118 equipment SVG exports. Ten dormant creature and 32 item templates support later additive live updates throughout the newly authored world bounds. See the world’s `docs/CONTINENT.md`. Source-only policy also excludes generated SVG exports.

The prior 245-test Emberwild run passed, as did the additional frontier live-content check, all 17 engine tests, the Meadow campaign, the 50-map rendered survey with flights/portals/save restoration, and full art reconstruction/round trips. Later content remains unpopulated and human visual/navigation/performance review is still required before calling the new regions polished or release-ready. Existing user saves were not used by automation.

## Creature ecology collection

The source library now contains 362 designs, including 208 creatures across 32 body shapes, with 15 palettes and eight assembled outfits. All 52 zones/capitals have five-type rosters and population budgets of 20. These plans and 188 new dormant enemy templates do not populate the running world. Encounter balance and placement remain future content work. See Emberwild’s `docs/CREATURE_ECOLOGY.md` and `/bestiary.html`.

## Equipment silhouettes and current website

Ten shape bands now cover levels 1–100 for every armor material and eleven weapon/offhand families: 40 new eight-piece armor sets and 110 weapons/offhands, retaining the original eight sets. The complete catalog has 881 entries, including all 89 non-template live equipment appearances, plus 48 assembled outfits. Counts on the website come from the build manifest. Generated site scenes, four demo films and the complete art workshop are rebuilt from source; binaries remain outside Git. No new drops or enemy placements are activated.

## Open-source documentation pass

Both projects now disclose initial Codex / GPT-6.1 Sol / GPT-6.1 Astra generation, retain MIT licensing and explain its scope, document experimental compatibility, link deployment/live API guides from their informational sites, and carry contributor/security/reporting guidance. The engine includes an offline JSON content/asset catalog for live-update template discovery. Release packaging includes project provenance and legal notices, including in art downloads. The intended public URLs are now configured; a published engine commit pin, reporting setup, hosted CI and independent validation remain explicit publication gates.

### Verification on 2026-11-10

The documentation/tooling pass passed 25 engine tests, 6 Meadow tests and all 278 Emberwild tests. Both world manifests validate. Both complete informational site builds passed with Firefox/software WebGL on the existing virtual display, including recorded demo outcomes and the full Emberwild workshop. Direct checks confirmed the linked API/deployment/provenance/license files resolve below a project URL prefix.

All four final release archives were generated and their SHA256SUMS verified. Fresh engine and starter extractions installed production dependencies from the local npm cache and became ready; independently installing the world-only pack into the extracted engine also launched Emberwild. These smoke checks used disposable saves and verified initial live revision zero. Indexed source guards passed in both repositories; new untracked source files also passed the source policy. This pass did not repeat the earlier Docker backup/restore drill, add broader OS coverage, publish repositories or run hosted GitHub workflows.

One final repeat hit an intermittent failure in the HTTP/socket isolation-and-restart test and then stalled in cleanup. Its earlier full-suite runs passed; the isolated test and a subsequent full 25-test TAP run with `--test-force-exit` also passed. The failure's cause was not established in this documentation pass; test stability should be checked in hosted CI.

## KithCore naming

The engine is named KithCore, with intended source/release/Pages destinations under `jspjut/kithcore`. Emberwild remains `jspjut/emberwild`, presented as a KithCore example world. Packages, Compose image names, release titles, documentation and client fallback branding use KithCore. Project-provided code/content retain their existing MIT notices and AI provenance. Existing world IDs and persistence namespaces are retained; the deployment guide explains how to retain an existing Compose project's save volume when changing folders.

The repositories have not been published by this task. Emberwild's engine repository is configured, but the tested full commit SHA must be set after the engine source is committed/published. GitHub Issues is the initial bug-reporting route; confidential vulnerability reports use GitHub private reporting once enabled. Custom domains have not been purchased or configured.

The naming pass passed 25 engine tests and 6 Meadow campaign/collision tests, both world manifest checks, both complete informational site builds and direct own-repository/release/cross-project/local-guide link checks under a project URL prefix. Fresh archive extractions with clean production dependency installations launched Meadow, the separately installed Emberwild pack and the Emberwild starter. Archive checksums and both repositories' source guards passed. The full Emberwild gameplay regression was not repeated for this branding/documentation pass; its previous 278-test result is recorded above.

## Initial publication verification (2026-11-16)

Before the first push, the intermittent socket-suite failure was reproduced with detailed TAP output: the temporary save directory was being removed by an earlier teardown hook while a server was still writing, causing `ENOTEMPTY` and leaving resources open. The test now closes clients and stops the server before deleting its temporary saves, including on failure. This changes test teardown only; gameplay and persistence behavior are unchanged.
