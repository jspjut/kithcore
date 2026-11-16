# CI verification and runner budget

Routine verification runs for pull requests and pushes to `main`/`master`, not every feature-branch push as well. A later push cancels superseded runs of the same workflow/ref. Full verification is a separate reusable workflow; release builds require it before packaging a draft.

| Check | Routine triggers | Complete verification |
| --- | --- | --- |
| Source policy | Every PR/default-branch push | Always |
| Engine unit tests, Meadow, package smoke | Every PR/default-branch push, Node 24 | Node 22 and 24 |
| World fast units/content | Changed source or engine pin | Always |
| Basic multiplayer/live updates | Changed runtime/client or relevant test tooling | Always |
| World network integration | Changed server/network definitions/tests or engine pin | Always |
| World geometry sweeps | Changed geography/collision/buildings/tests or engine pin | Always |
| Complete generated art | Changed art recipes/registries or engine pin | Source-matched cached exports verified; otherwise rebuilt |
| Full campaigns, capacity and specialized browsers | Manual/nightly/release | Always |
| Engine Docker readiness | Relevant runtime/container changes | Always |

A docs-only world PR runs its standalone source guard without cloning/installing the engine or generating art. The engine's small routine suite remains cheap enough to run on docs changes. GitHub Actions chooses conditional jobs from a full-history local Git diff, rather than relying on the API's truncated changed-file lists. Required branch-protection checks should use the always-running `fast` job; full nightly verification is not a required per-commit status.

## Nightly changes-only gate

`full.yml` is scheduled at **07:23 UTC** (02:23 Eastern Standard Time / 03:23 Eastern Daylight Time). GitHub may delay scheduled runs. A small gate checks changes before any expensive jobs start:

- Compare the checked-out default-branch source with the previous **completed scheduled attempt** of this full workflow.
- Identical source, or documentation/site-copy-only changes, skip all expensive full jobs. The small gate still starts each night; GitHub cron itself is not conditional on commits.
- On the first scheduled attempt, check relevant commits in the preceding 24 hours. There is no unconditional full build just to establish a baseline.
- Comparing revisions after the first run covers changes across delayed/missed nights, instead of leaving gaps between rolling 24-hour windows.
- A failed full attempt remains visible but is not retried nightly without another relevant change. Use **Actions → full verification → Run workflow** to retry explicitly. Manual runs always execute, and may select a ref. They do not advance the nightly baseline, because a manual run can target a different ref.
- Release verification always executes, regardless of the nightly gate. No personal access token is stored in Actions; the gate uses that repository's built-in `GITHUB_TOKEN` with `actions: read`.

## World-owned test suites and deadlines

Worlds can supply `tests/suites.json` with named profiles containing optional `includeFiles`, `excludeFiles` and literal `excludeNames` arrays, plus optional `concurrency` (1–8 workers). Filenames must identify actual `tests/*.test.js` files; unknown files/profiles fail. Full verification is the default and applies no exclusions.

From the installed engine root:

```sh
node tools/test-world.js --world emberwild --suite fast
node tools/test-world.js --world emberwild --suite network
node tools/test-world.js --world emberwild --suite geometry
node tools/test-world.js --world emberwild --timeout 900
```

The fast world profile requires no generated exports. It omits exhaustive asset tests, campaign simulations, real network/load tests and large geometry sweeps, which retain their own selected/full jobs. A real two-browser live-update smoke test supplies basic multiplayer/rendering coverage on runtime changes. The full suite still selects all tests.

Fast suites default to a five-minute process deadline; full suites/scripts default to fifteen minutes. `--timeout <seconds>` changes that bound (1–5400 seconds). TAP reporting exposes test progress. A deadline terminates the POSIX test process group, including spawned servers, and exits 124; it is a failure, never a passing skip. Browser and job deadlines provide additional bounds.

## Reusing generated work

Playwright downloads and npm archives are cached. World model/preview caches include world source and the engine pin; restored exports undergo manifest/hash/loader checks. Collision source snapshots must remain unchanged after rebuilding. Release verification retains full checks even when exports can be reused.

Pages caches generated images/videos by gameplay source, rendering/recording tools, scenes/flyby and the pinned dependency lockfile. Documentation and ordinary site description edits do not change that media key. Builds still copy current docs/licenses, assemble current runtime files and browser-check scenes, the workshop, mobile layout and playback controls. No generated media, caches or exports are committed to Git. A local build without `--media-cache` records fresh media.

Pages builds only trigger for relevant website/docs/runtime paths, or manually. Publishing still requires GitHub Pages source **GitHub Actions** and either repository variable `ENABLE_PAGES=true` or a manual `deploy` input. This CI optimization does not turn on public deployment.

A run already started under an older workflow does not adopt these limits or cancellation settings. Cancel obsolete runs through GitHub's UI if needed; repository Contents/Workflows write permission alone does not grant the token Actions cancellation permission.
