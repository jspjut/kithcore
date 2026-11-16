# Security and supported use

This alpha supports local/LAN experimentation. Public-service hardening, account recovery, moderation and production-scale operational validation are unfinished. HTTPS/WSS and an access-control design are required before treating it as a public account service.

Browser identities are random bearer credentials stored in site storage. Server character documents contain those credentials and private correspondence. Keep `data/`, backups, environment files and logs out of source control and public downloads. Do not expose operator directories through the static server. The supplied release packager uses explicit file inputs and rejects obvious private/generated paths and symbolic links.

World packs are trusted source code. They can execute server-side JavaScript. Content validation and runtime assembly are not a security sandbox; operators must review/trust external packs before installing them.

## Reporting

Use [GitHub Issues](https://github.com/jspjut/kithcore/issues) initially for ordinary bugs and feature requests. Include engine/world versions and a minimal reproduction with disposable data. The repository address is the intended public destination and must be published before reports can be submitted.

For a potential vulnerability, do not include exploit instructions, bearer keys, saves or private correspondence in a public issue. If [GitHub private reporting](https://github.com/jspjut/kithcore/security/advisories/new) is enabled, use that form. Otherwise, open a minimal issue requesting private contact, without sensitive details. Private reporting still needs to be enabled in repository settings; no private email address is configured.

See [GitHub's private reporting setup](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
