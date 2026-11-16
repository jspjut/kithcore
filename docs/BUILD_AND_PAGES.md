# Source-only repositories, generated releases and GitHub Pages

Both repositories store UTF-8 source, definitions, procedural factories, documentation and build recipes. Generated models, thumbnails, video recordings, compiled websites and archives stay out of Git. No Git LFS is needed. The entire Emberwild library is retained, including unused/future designs: **881 catalog entries × 15 palettes = 13,215 combinations**, plus 48 assembled sets. Build/test recipes enumerate the complete library, never just the models referenced by current quests or spawns.

## Clone and install

Install Node.js 22+ (24 recommended for matching CI), Git and standard `tar`. Clone the engine, then optionally clone Emberwild into `worlds/emberwild/` or use any other directory with `--world /absolute/path`. No submodule or LFS checkout is required. From the engine root:

```sh
npm ci
npm run hooks:install
npm run check:source
npm test
npm run test:minimal
```

For the independent world, install its own hook with `node tools/check-source.mjs --install-hook` **from its repository root**. It needs Node on PATH, including when Git launches the hook. If using the launcher's local runtime, put the engine's `.tools/node/bin` on PATH before invoking Git. Hooks are opt-in after cloning because Git does not activate hooks from downloaded source automatically. These hooks are installed in the current local repositories too.

The source checker examines both staged blobs and the working files (including intent-to-add). It rejects binary formats, binary/NUL/non-UTF-8 data, known generated/private output paths, links/submodules, LFS pointers/configuration and files above 1 MiB. SVG and ordinary textual definitions are source. It checks indexed files, so local ignored models remain usable. New output directories must be added to the ignore/policy rules when introducing new build tools. Source review is still needed; a text-file check cannot prove a file was authored by a human.

CI runs the checker independently of hooks. Configure branch protection to require the verification checks before merging; local hooks can be bypassed, and `.gitignore` alone does not prevent forced additions. Do not commit generated files to `main`, `gh-pages` or any other source branch.

## Rebuild the entire Emberwild collection

Ordinary gameplay creates its visuals from source factories and does not need pre-exported GLBs/PNGs. For the optional model library, full export verification or world release builds:

```sh
npx playwright install --with-deps firefox ffmpeg
# Linux with software WebGL / a display-less build runner:
xvfb-run -a env HEADED=1 LIBGL_ALWAYS_SOFTWARE=1 npm run build:world-assets
npm run test:emberwild
```

On a machine with working headless WebGL, `npm run build:world-assets` can run directly. The command assembles a disposable runtime, generates every model, starts a private temporary server, renders every preview, verifies the GLB/PNG exports and copies outputs to the world's ignored `client/assets/` directory. It uses disposable saves and cleans up its server. A source-only checkout needs no preexisting exported files. Select a world outside the default folder with `node tools/build-world-assets.js --world /path/to/emberwild`.

The command also refreshes `shared/prop-profiles.js`, the textual collision snapshot consumed by gameplay. This file is intentionally checked in with source definitions so gameplay does not require an art-build step. Review/commit it when changing collision recipes; CI checks that rebuilding it does not change the checked-in version. Procedural factory files and the complete registry remain in every world source release.

Older individual `build:assets` and `preview:assets` commands remain available for authoring. The combined command is the recommended clean-clone and CI workflow.

## Build the websites locally

These are independent static project landing pages, not hosted authoritative game servers. Each has an overview, three source-built interactive scenes, still images and four focused silent WebM demo recordings. Emberwild also offers the complete asset workshop, all curated files and a generated art `.tar.gz`. Scenes run without WebSockets or a backend; demo gameplay is recorded from a disposable server during the build. Scene interaction is opt-in. Videos default to muted, looping autoplay while visible, pause offscreen/when the tab is hidden, and keep native playback controls plus a page-level pause button. Reduced-motion visitors get paused posters unless they explicitly choose playback. The four clips show race/class/appearance customization, a moving camera flyby, actual server combat and looting, and an authored two-NPC exchange using real social events. Build-only staging and temporary servers never change operator saves or normal world behavior. Recording startup is trimmed with Playwright’s explicitly installed FFmpeg (or `FFMPEG_PATH`), and `media/manifest.json` records the verified outcomes.

From the engine root, after installing Playwright/Firefox:

```sh
# Engine + Meadow website
xvfb-run -a env HEADED=1 LIBGL_ALWAYS_SOFTWARE=1 npm run build:site
PORT=3085 npm run preview:site

# In another terminal, after build:world-assets:
xvfb-run -a env HEADED=1 LIBGL_ALWAYS_SOFTWARE=1 node tools/build-site.js --project world --world emberwild --output worlds/emberwild/.site
PORT=3086 node tools/serve-static.js worlds/emberwild/.site
```

Open `http://localhost:3085` or `http://localhost:3086`. Stop a preview server with Ctrl+C. The build verifies rendering under a `/project-preview/` URL prefix, checks a compact viewport, captures media and rejects page/shader/missing-resource errors. This catches path mistakes hidden by testing only at a domain root. The world build also boots the static workshop and exports a model from it.

Outputs are `.site/` and `worlds/emberwild/.site/`, both ignored. Rebuilding replaces an earlier marked site build. A nonempty output directory without the build marker is refused. The build includes public client/shared/vendor files and generated assets, not servers, saves, bearer keys, authoring story documents or the complete engine checkout. Videos/images are never source inputs. Changes to scenes/media are made in the source configuration/renderer and regenerated.

The committed site configuration provides the intended source/release links for local builds. Use `--repository owner/repository` to override the current project for a fork; CI sets it from `GITHUB_REPOSITORY`. Cross-project links also have environment overrides, described below.

## Configure GitHub CI and Pages

The engine includes verification, Pages and release workflows under `.github/workflows/`. Emberwild includes its own independent workflows. Before running world CI, set the **full 40-character SHA** of a tested, published KithCore engine commit in `worlds/emberwild/.github/engine.json`. Its repository is already `jspjut/kithcore`; change it only for an intentional fork. Commit that compatibility pin in the world repository. Empty values deliberately fail with a setup message. A floating branch is rejected, so a future engine change cannot silently alter a world release. The pin must identify an engine commit containing these build tools.

For each repository:

1. Publish the source-only repository and run verification.
2. Select **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Run **Build project website** / **Build Emberwild website** from the default branch with `deploy` enabled, or set repository variable `ENABLE_PAGES=true` to deploy successful default-branch pushes automatically.
4. Protect the `github-pages` environment/default branch as appropriate. Pull requests build and verify artifacts but never deploy, including when the variable is enabled.

The Pages build creates an upload artifact; a separate deployment job has only the required Pages/OIDC permissions. No build job writes output back to Git, no deployment branch is created and no source commit is made by a workflow. Workflows monitor `main` and `master` pushes; adjust that branch list if choosing another default branch. Draft release publication is independent of Pages deployment.

Official setup references: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [selecting the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Build and review release artifacts

```sh
# Engine release, including Meadow:
npm run package:release

# Build the world exports first, then generate all four downloads:
npm run build:world-assets
npm run package:release -- --world emberwild --assets
(cd dist && sha256sum -c SHA256SUMS)
```

The second command set produces engine, world-only, combined starter and a separate `emberwild-assets-<version>.tar.gz` collection. Generated model/preview files can be present in release artifacts while remaining ignored by Git. Normal game downloads exclude nested `.zip`/`.tar.gz` archives from `client/assets/`; the source generator code is retained in the world and starter downloads. Build artifacts have file manifests and archive checksums.

A pushed `v<version>` tag, or a manual release-workflow run selecting an existing matching tag, builds and verifies archives and creates a **draft prerelease** with attachments. Engine tags must match `package.json`; world tags must match `world.json` and use their committed engine compatibility pin. Review release gates, notes, hashes and clean-install tests before publishing the draft. The workflows do not publish a public release automatically or overwrite existing release assets on rerun.

Local code can be fully built/tested before remote setup. The intended repositories are configured as `jspjut/kithcore` and `jspjut/emberwild`. Emberwild still needs the full SHA of a tested, published KithCore commit in `.github/engine.json`; hosted CI, Pages deployment and draft creation remain unexercised until publication setup is complete.

The engine landing page is titled **KithCore** and emphasizes reusable server/client capabilities: social/chat/mail, combat/quests/objects, presentation customization, independent world content and deployment. Meadow illustrates those features as the included sample. Demo fixtures run only inside disposable assemblies; no administration/debug API is exposed on production servers.

## Publication links and provenance

Both sites disclose that the initial release was generated by Codex with GPT-6.1 Sol and GPT-6.1 Astra. They include MIT/provenance/third-party notices, live API documentation, deployment and compatibility guides. These are informational sites; download links lead to repository releases and the server runs on the operator's chosen host.

The engine's `site/site.json` defaults to `jspjut/kithcore` and links to `jspjut/emberwild`; the world site defaults to `jspjut/emberwild` and resolves its required engine from `.github/engine.json`. Local previews therefore include the intended source/release/cross-project links without extra flags. `GITHUB_REPOSITORY` / `--repository`, `EMBERWILD_REPOSITORY` and `ENGINE_REPOSITORY` remain available as overrides for forks or alternate builds. Values are validated as `owner/repository`.

The intended informational sites are `https://jspjut.github.io/kithcore/` and `https://jspjut.github.io/emberwild/`. No custom domain or CNAME is configured: registration and DNS for kithcore.com / kithcore.org remain a separate maintainer choice. Publishing the source and enabling Pages are still required before these destinations are live.

CI runners are pinned to Ubuntu 24.04 to match the pinned Playwright/Firefox build. Update the runner image and browser automation dependencies together; a moving `ubuntu-latest` can select an unsupported OS.

Install the `ffmpeg` Playwright tool explicitly alongside Firefox for demo-video recording/trimming. The live-update browser fixture uses a ranged variant of its new practice skill so normal creature roaming during earlier UI checks cannot make that unrelated assertion fail. The authored Meadow example keeps its ordinary skill range.
