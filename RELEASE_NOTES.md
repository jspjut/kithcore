# 0.1.0-alpha.3 — initial open-source alpha

A social-first MMORPG sandbox generated in Codex with a mix of GPT-6.1 Sol and GPT-6.1 Astra under human direction. See PROVENANCE.md for origin and licensing scope.

KithCore includes Meadow Sample. Emberwild is a separate, larger example requiring a compatible KithCore engine; a combined starter includes a tested pair. Deploy with the included Node launcher/npm commands or Docker Compose. GitHub Pages provides information and previews, not a hosted multiplayer service.

This release supports validated persistent live updates for additive NPCs, encounters, quests, items and abilities, plus dialogue/quest wording, announcements and vendor stock. Geometry, new mechanics and removals require maintenance. See the engine's docs/LIVE_UPDATES.md for the developer API and template catalog.

Known limits: experimental APIs and saves, browser-local bearer identities without recovery, one writer per world, no production account/moderation stack, and no sustained MMO-scale capacity claim. Review compatibility/deployment guides before upgrading and back up the complete stopped save directory with its live journal. Publication checks remain in docs/OPEN_SOURCE_RELEASE.md.

Downloads include file inventories and SHA256SUMS. MIT covers project material as described in PROVENANCE.md; third-party components retain their notices. No model service is required during play.

Intended upstream repositories: [KithCore](https://github.com/jspjut/kithcore) and [Emberwild](https://github.com/jspjut/emberwild). The engine archive is `kithcore-engine-<version>.tar.gz`; combined starter names include `-kithcore-<engine-version>`.
