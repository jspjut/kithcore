# Compatibility and support

This is an experimental alpha. Engine `0.1.0-alpha.3` and world runtime API `1` are the current baseline. An API number is a structural check, not a guarantee that every alpha engine/world pairing works. Test and distribute an exact pair; Emberwild CI pins the engine repository and full commit in `.github/engine.json`. A starter archive records both versions in its filename and manifest. Release manifests inventory payloads; `SHA256SUMS` verifies download integrity, not publisher identity.

Use Node.js 22+; CI targets Node.js 24. Linux is the primary development platform. The launcher supports Linux/macOS x64/ARM64. Windows uses an installed Node runtime and npm commands. Desktop WebGL is required. Broader platform/browser testing remains pending; no support SLA or security maintenance period is promised. Report issues with exact versions, platform, browser and reproduction steps. Never attach saves or bearer credentials.

During alpha, world interfaces, live-update schemas and saves can change. Release notes must describe changes and migrations. Back up the entire stopped world data directory before upgrades, including the live journal, and test restore with its matching engine/world pair. Runtime API mismatches are rejected. Existing live journals are tied to their source baseline; follow [live-update maintenance](LIVE_UPDATES.md#persistence-backups-and-maintenance-releases) rather than deleting a journal to force startup.

The supported deployment model is one process/store writer per world save directory. Public hosting, production accounts and sustained MMO-scale capacity are outside the current validation. See [deployment](DEPLOYMENT.md) and [security](../SECURITY.md).
