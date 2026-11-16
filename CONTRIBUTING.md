# Contributing

Install Node.js 22+, run `npm ci`, then `npm test`, `npm run test:minimal` and `npm run world:check`. If using `./start.sh`'s project-local Node, put `.tools/node/bin` on PATH first. Runtime dependencies are pinned in the lockfile.

Core source lives in `server/`, `shared/`, `client/` and `tools/`. The included world is `worlds/minimal/`. Other worlds are installed independently; `worlds/emberwild/` and `worlds/local/` are ignored by the parent repository. Follow [world authoring](docs/WORLDS.md) for content-only changes.

Tests should exercise meaningful invariants and user-visible behavior. Use disposable save directories. Never point fixtures or browser automation at someone's regular characters. The generic smoke test does this automatically:

```sh
npx playwright install --with-deps firefox
npm run test:browser
```

On Linux where headless WebGL is unavailable, install Xvfb and run `xvfb-run -a env BROWSER=firefox HEADED=1 npm run test:browser`. Results and screenshots go to ignored `test-results/`. `BROWSER=chromium` selects Chromium if installed. Renderer startup must work; a skipped/blank scene is not a successful browser check.

When Emberwild is installed from source, first generate its ignored model exports/manifest with `npm run build:assets` and its thumbnails with `npm run preview:assets` (see the asset guide for a disposable server), then run `npm run test:emberwild` for its full regression suite. Named browser scripts such as `npm run test:city-life` assemble a development runtime for that pack; scripts which need an existing disposable server/fixture retain their documented requirements. Use `npm run test:emberwild:browser` for its original broad browser workflow. Asset scripts use a separate authoring runner: `npm run build:assets`, `npm run preview:assets` and `npm run package:assets` write generated files back into the installed Emberwild pack. The build also updates that pack’s collision profiles; it does not change engine source. Run fixtures with `node tools/test-world.js --world emberwild --script tests/roster-fixture.js` (substitute the desired fixture), using the absolute disposable save/output paths required by the fixture. Successful fixture generation stamps its directory with the selected world identity.

Keep authored definitions and presentation in a world pack. Reuse core rules rather than copying simulation behavior. Run focused checks while developing and the relevant regression suite before submitting. New world/module interfaces require compatibility notes, validation and examples. The API remains experimental until the alpha release gates are met.

Issues and pull requests should explain the trigger, expected/actual behavior, relevant engine/world versions and validation. Never attach character stores, bearer keys or private logs. See [security](SECURITY.md). No external service configuration or contributor agreement is currently required; contributions are distributed under the applicable repository license.

The default client now belongs to the engine. Both games use it directly; keep game-specific scenery, race meshes and UI text in their adapters. See `docs/CLIENT_CUSTOMIZATION.md` for theme/extension/replacement boundaries. The included sample must exercise the full UX with its own content and registries rather than acquiring a parallel reduced client.

Live content changes must preserve the additive-only definition boundary and synchronize clients before new actor snapshots. Run `npm run test:live:browser` for the real-browser workflow; `LIVE_TEST_WORLD=emberwild` selects the installed Emberwild demo. The normal `npm test` suite covers operator requests, validation, persistence failures, stale revisions and restart replay. Read `docs/LIVE_UPDATES.md` before changing the bundle schema or journal format.

Keep rebuildable binary exports out of Git. Emberwild ignores its model/preview/archive outputs; commit their procedural source and build scripts instead. No Git LFS is required. Release builds can include generated outputs from disk; see `docs/RELEASING.md` for the source-versus-artifact policy.

Install the local source-only hook with `npm run hooks:install` after cloning; CI also checks staged/source files independently. Generated site/media output is never committed. The recommended clean-clone art command is `npm run build:world-assets`, which rebuilds and verifies the complete library against a disposable server. Do not prune unused/future generators. See `docs/BUILD_AND_PAGES.md` for website builds, full-library invariants and pinned world CI.

Disclose significant AI-generated contributions and identify external sources/licenses in pull requests. Submit only material you have rights to contribute under the applicable MIT license. See [provenance](PROVENANCE.md). Be respectful, explain disagreements and avoid harassment in project discussions.
