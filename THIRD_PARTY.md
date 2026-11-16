# Third-party software

The engine and included minimal game are distributed under `LICENSE` (MIT). External world packs carry their own license and notices; Emberwild currently uses MIT as well.

| Dependency | Use | License | Source |
| --- | --- | --- | --- |
| Three.js 0.180.0 | Browser 3D rendering | MIT | https://github.com/mrdoob/three.js |
| ws 8.22.1 | WebSocket server and integration clients | MIT | https://github.com/websockets/ws |
| Playwright 1.56.1 | Development-only browser automation | Apache-2.0 | https://github.com/microsoft/playwright |
| Node.js | Runtime; optionally downloaded by `start.sh` | MIT plus bundled third-party notices | https://github.com/nodejs/node/blob/main/LICENSE |

Installed packages retain their license files under `node_modules/`. The optional local Node.js distribution includes `LICENSE`. Preserve these notices when redistributing bundled dependencies. Browser engines downloaded by Playwright are development tools, not shipped game assets.

The client loads Three.js from the local server and uses system fonts. All scenery, characters, icons made in code, and synthesized sounds are authored in this repository. No external game assets, emulator code, or proprietary game files are required.

Project generation provenance and license scope are documented in [PROVENANCE.md](PROVENANCE.md). Dependency authors are separate from the project generation credits.
