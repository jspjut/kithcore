# Initial alpha release checklist

Release preparation is implemented locally. Public publication is a separate maintainer action; do not mark these gates complete without evidence.

- [x] Choose KithCore and the intended repositories `jspjut/kithcore` and `jspjut/emberwild`; configure local site/release links.
- [ ] Publish both repositories and verify source, issue, release and Pages links. Set Emberwild's `.github/engine.json` to a tested full KithCore commit SHA after the engine source is committed and published. The repository name is configured; the commit pin remains unset.
- [ ] Verify the initial Issues reporting workflow in both repositories. Enable GitHub private vulnerability reporting for confidential details; until enabled, SECURITY.md asks for a minimal contact request without sensitive details.
- [ ] Review MIT scope, retained copyright holder notices, AI provenance and dependency notices; check every contributed/imported asset has permission to redistribute. Provenance is disclosed, not an exhaustive legal audit.
- [ ] Commit only intended source changes; review the existing development changes, run both source guards, hosted CI and branch protection checks.
- [ ] Run engine and Meadow tests, Emberwild regressions, relevant browser/live-update checks, complete asset exports and both Pages builds from clean checkouts.
- [ ] Extract each game download into a fresh directory; verify checksums, install fresh production dependencies and exercise Node/Compose start, readiness, saves, stop/restart, live updates and backup/restore with disposable profiles.
- [ ] Have an independent user follow the install guide; record tested OS/browser versions, accessibility limits and human playtest findings. Do not claim sustained player capacity from short functional tests.
- [ ] Check both public sites: correct source/release/cross-project links, prominent AI disclosure, downloadable artifacts, API/deployment guides and license notices. Pages must not advertise a hosted game server.
- [ ] Use matching version tags, review draft prerelease notes and publish downloads, manifests and SHA256SUMS. Retain the exact paired source refs and artifacts for rollback.

Production accounts, transactional storage, moderation/abuse controls and sustained load validation remain additional work for public game services. They do not prevent an explicitly experimental source alpha.
