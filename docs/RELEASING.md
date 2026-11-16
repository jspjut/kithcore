# Release artifacts

The engine and worlds have separate source repositories and independently versioned artifacts. The root repository contains reusable code and Meadow Sample. Emberwild lives at `worlds/emberwild/` as an ignored, separate repository. No Git submodule is required. The intended repositories are `jspjut/kithcore` and `jspjut/emberwild`.

## Distribution plan and package sizes

There are **two source repositories** and three useful release downloads:

1. **KithCore engine + Meadow:** this root repository owns the reusable authoritative server, browser client, shared rules, tools, documentation, tests and the small Meadow example. Meadow is a world pack within this repository, not a separately maintained source project. It demonstrates the shared UX and class/race systems with a small amount of content.
2. **Emberwild world-only:** an independent repository owns the larger demo's definitions, geography/presentation, art, story, authoring notes and tests. Describe it as a **larger demo game with a mostly complete starting zone**, not a finished MMO. Install its clone or extracted release at `worlds/emberwild/`, or use its absolute path with the world launcher. The engine repository ignores that folder, so world history/assets do not enter engine history. This is an optional dependency from Emberwild to a compatible engine; the engine does not depend on Emberwild.
3. **Emberwild starter:** a generated engine + Meadow + Emberwild download for people who want to try the larger demo without installing the components separately. It records both versions and selects Emberwild by default. No third source repository is needed.

Source repositories serve contributors; release archives serve players/operators. Host versioned archives and checksums as repository release attachments. A project website can provide clear download buttons linking to those same artifacts, rather than a second independently maintained copy. For a first-time user, present “Build your own game: engine + Meadow” and “Try the larger demo: Emberwild starter”; offer the world-only download for existing engine users. Git is optional for archive users. Public source/release/Pages destinations are configured locally for `jspjut/kithcore` and `jspjut/emberwild`; publication and remote verification remain pending.

The planned game/starter download format is `.tar.gz`, matching Linux-first deployment. Additional ZIP game downloads are optional, not a release requirement. The existing exported-model ZIP is a separate art resource and cannot run the game. Archive users still install Node/dependencies or use Docker.

Approximate **alpha.3 candidate** sizes, measured from archive entries/source bytes rather than allocated filesystem blocks (decimal kB/MB; excludes dependencies, Node, Git history, saves and caches):

| Component | Compressed download | Uncompressed files | Notes |
| --- | ---: | ---: | --- |
| Core server/client/shared runtime | ~181 kB | ~568 kB | Measurement-only tarball; not a separate supported download |
| Core runtime plus operator/development tools | ~195 kB | ~613 kB | Excludes docs/tests/Meadow |
| Meadow world pack | ~17 kB | ~44 kB | Measurement-only tarball; included in the engine release |
| Engine + Meadow release | ~0.25 MB | ~0.78 MB | Includes docs, tests, notices, tools and manifest |
| Emberwild world-only release | ~8.4 MB | ~18.2 MB | Includes authored content, art, tests and documentation |
| Emberwild starter | ~8.7 MB | ~19.0 MB | Engine + Meadow + Emberwild |

Actual byte counts/hashes for a particular release are in `release-index.json` and each archive's `RELEASE-MANIFEST.json`; ZIP sizes will differ. Installed production dependencies currently occupy roughly 33 MiB on this development machine; Node installation is additional and platform-dependent. Neither is bundled into these source archives. The locally built game container image is about 78.5 MB uncompressed, a separate measurement from compressed source downloads or registry transfer size.

Emberwild's pack currently contains a ~4.17 MB exported asset ZIP alongside the individual model files. A measurement-only repack omitting that ZIP and the old manifest was ~4.46 MB compressed, versus ~8.41 MB for the current world release. Before publication, make the exported ZIP an optional separate art download and remove the nested archive from normal world/starter payloads, after checking authoring-tool/documentation expectations. Keep the runtime assets. The packager now excludes nested archives and can produce a separate complete art `.tar.gz` with `--assets`; older candidates still contain the ZIP. These size figures describe the earlier alpha.3 candidates, before the source-only/website tooling milestone.

## Source control and generated art

Git stores authored source, textual definitions, procedural art factories, build tools and documentation. Emberwild's generated `client/assets/models/`, `previews/`, model ZIP, catalog and manifest are ignored and excluded from its index; local copies remain available. No Git LFS is required. Source factories construct the live game's visuals, so ordinary gameplay does not require prebuilt GLBs/PNGs. The asset workshop's curated downloads/catalog/previews and export verification do require generated outputs.

After installing a fresh Emberwild source checkout, use `npm run build:world-assets` before `npm run test:emberwild`; the combined command starts a disposable preview server, generates models/thumbnails and verifies both. See [source builds and Pages](BUILD_AND_PAGES.md) for Linux/browser setup. These steps are also required for releases containing the optional curated art collection. The packager copies available world files from disk, including ignored generated exports; keeping exports out of Git does not keep them out of release artifacts. Build and validate them deliberately on the release machine. A source-only world is sufficient for gameplay; a release promising the curated art collection needs those generated files.

Avoid generated binaries in Git regardless of size. The source-only checker rejects binary formats, known generated paths, links, LFS pointers and non-UTF-8 content, and enforces a 1 MiB source-file review limit. Non-regenerable binary inputs must be separate versioned downloads with checksums and an explicit acquisition step. Do not introduce LFS as an implicit setup dependency. Install the local hook and require the CI check as described in [the build guide](BUILD_AND_PAGES.md).

## Build and verify artifacts

With Node.js 22+ and the standard `tar` tool installed:

```sh
npm ci
npm test
npm run test:minimal
npm run world:check
npm run package:release
```

The base artifact is `dist/kithcore-engine-<engine-version>.tar.gz`. It includes the minimal example, source, instructions, tests and container recipe. It excludes installed dependencies; first setup installs pinned dependencies from the lockfile. `.tools/` runtimes and private saves are never bundled.

When Emberwild is installed:

```sh
npm run world:check -- --world emberwild
npm run build:world-assets
npm run test:emberwild
npm run package:release -- --world emberwild
```

This additionally produces:

- `emberwild-world-<world-version>.tar.gz`: independently distributed world source, assets, authoring documents, tests and license, ready to extract into an engine's `worlds/emberwild/` directory.
- `emberwild-starter-<world-version>-kithcore-<engine-version>.tar.gz`: engine + minimal example + Emberwild, with `default-world.json` selecting Emberwild for the Node launcher and an automatically loaded `compose.override.yaml` selecting its read-only mount for Docker. Either setup uses one command; both versions identify the combination unambiguously.

Use `npm run package:release -- --world emberwild --assets` to produce the separate generated-art tarball under its included license. The legacy ZIP authoring command remains available locally, but game/starter release payloads exclude nested archives. Keep generated asset files and source factories consistent when rebuilding them.

Every archive has `RELEASE-MANIFEST.json` containing hashes and sizes of its payload files (excluding the manifest itself). `release-index.json` and `SHA256SUMS` identify the complete archive digests. Verify downloaded archives with `sha256sum -c SHA256SUMS` from the output directory (or an equivalent SHA-256 tool). Filenames carry versions, but tar/gzip output is not yet guaranteed byte-for-byte reproducible across platforms.

Build each candidate from a clean checkout/install; extract it somewhere else, install dependencies, validate and launch it. Verify that the engine artifact works with no Emberwild directory present, then install the world-only artifact and verify the larger demo. Exercise the starter archive's default launcher separately. Also test the published container image, named-volume persistence, shutdown and restore.

The packager has explicit input lists in `tools/package-release.js`; review changes to those lists. It does not scan Git history or prove asset provenance. Before publication, review repository history, dependency advisories and notices; establish a security contact; complete human playtests and the remaining [release gates](RELEASE_STATUS.md).

Publishing/pushing repositories, images or downloads is a separate operator action. This tooling creates local reviewable artifacts and does not upload them.

GitHub CI can regenerate the complete art library, build draft release attachments and deploy generated landing pages without committing outputs. See [BUILD_AND_PAGES.md](BUILD_AND_PAGES.md) for commands, the independent world engine pin, Pages configuration and source-only enforcement.

## Initial open-source release

Follow [the publication checklist](OPEN_SOURCE_RELEASE.md) before publishing. Archives include project provenance, contributor/security guidance and release notes. The packager also writes `dist/RELEASE_NOTES.md`; tag workflows use that reviewed file as the draft body. Art downloads retain LICENSE, THIRD_PARTY.md and PROVENANCE.md. The source catalog (`npm run content:catalog -- --world minimal`) supports developer template discovery without a server or prebuilt art.
