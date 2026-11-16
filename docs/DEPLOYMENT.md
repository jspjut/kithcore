# Deployment and operation

## Local Node setup

Run `./start.sh` on Linux/macOS, or install Node.js 22+ and run `npm ci --omit=dev` followed by `npm start` on Windows. The shell launcher uses a system Node when available and otherwise installs its checksum-verified local runtime in `.tools/`. No model/API credentials are required. The local Node installer needs curl, tar and a SHA-256 utility.

The world is assembled at startup. Restart after editing its definitions or engine source. `npm run dev` currently uses the same snapshot-based launcher; there is no live-content reload.

| Setting | Default | Meaning |
| --- | --- | --- |
| `WORLD` or `--world` | `default-world.json`, then `minimal` | Installed world name or directory; command-line selection wins |
| `HOST` | `0.0.0.0` | Node listening interface; set `127.0.0.1` for local-only play |
| `PORT` | `3080` | Node listening port |
| `DATA_DIR` | `data/<world-id>/` | Private saves, relative to the launcher's working directory when explicitly supplied |
| `ALLOW_LEGACY_SAVES` | unset | Set exactly `1` to adopt a backed-up, unmarked old character document |

The launcher does not read `.env` into Node's environment. `.env.example` describes Docker Compose interpolation. On Windows use `npm start` for Meadow, or select an independently installed pack with `npm start -- --world <world-id>`. Set environment variables using your shell's syntax.

## Docker setup

```sh
docker compose up --build
```

Open http://localhost:3080. Compose publishes to `127.0.0.1` by default. Set `BIND_ADDRESS=0.0.0.0` for LAN access and allow the chosen host port in your firewall. Set `PORT=3081` for a different host port. The container always listens on 3080; Docker maps the chosen host port to it.

The base image includes the engine and minimal pack. Emberwild stays outside the image and mounts read-only:

```sh
docker compose -f compose.yaml -f worlds/emberwild/compose.override.yaml up --build
```

The override's paths are relative to the engine's base Compose file. For another external pack, supply a similar override mounting it at `/world:ro` and setting `WORLD: /world`. Keep public image tags and world versions together in deployment records.

Combined starter archives already include an automatically loaded root `compose.override.yaml`, so their Docker setup is just `docker compose up --build`. The image itself defaults to the included minimal pack; the starter's selected world stays in its external read-only mount.

The container runs as Node's unprivileged user. Its root filesystem is read-only, with writable temporary runtime storage and a named save volume. Compose drops capabilities, limits CPU/memory, forwards signals through an init process and gives shutdown 20 seconds. The base image does not include tests, authoring files, installed development dependencies or Emberwild assets.

`/health` reports process/world status. `/ready` also returns 503 after a failed persistence operation until a later save succeeds. These endpoints include world/population information, not identities or bearer keys. The Docker healthcheck follows the configured container `PORT`.

## Save locations and backups

Node saves are under `data/<world-id>/`. Docker saves are under `/app/data/<world-id>/` in the Compose `saves` volume. `characters.json` includes bearer credentials and correspondence; treat the entire directory as private. Do not commit, package or put it beneath a web root.

For a consistent backup, stop the game gracefully, copy/archive the complete data directory (including `world-state.json`), then restart. For Node, Ctrl+C waits for a final save. For Docker:

```sh
docker compose stop game
mkdir -p ../kithcore-backups
chmod 700 ../kithcore-backups
docker compose run --rm --no-deps -T --entrypoint tar game -czf - -C /app/data . > ../kithcore-backups/saves.tar.gz
docker compose start game
```

Do not use `docker compose down -v` unless you intend to delete the save volume. A restore should first target a separate directory/volume. Launch the same world/compatible content version, verify characters and progression, then deliberately switch deployment. Protect browser site storage as well: server backups alone do not give the UI an account-recovery workflow.

The backup command above overwrites `saves.tar.gz`; use a new filename for each snapshot you want to retain. To restore into a **new, empty** named volume:

```sh
docker volume create kithcore-restored
docker run --rm -i -v kithcore-restored:/app/data --entrypoint tar kithcore:0.1.0-alpha.3 -xzf - -C /app/data < ../kithcore-backups/saves.tar.gz
```

Use that restored volume in a separate test deployment with the matching world before replacing your regular volume. The image initializes `/app/data` for its unprivileged user. Never extract a backup over live writers. For a copied Node save directory, stop the writer and archive/copy that complete directory using the equivalent host tools.

## Existing Emberwild saves

The old project used `data/characters.json`. The new launcher leaves that file and its backups alone. Its default Emberwild path is `data/emberwild/`.

To adopt the old saves, first stop the old server and back up its data directory. Copy `characters.json` into the new `data/emberwild/` directory, then launch once with explicit legacy adoption:

```sh
mkdir -p data/emberwild
cp data/characters.json data/emberwild/characters.json
ALLOW_LEGACY_SAVES=1 ./start.sh --world emberwild
```

After a successful startup, the new directory has `world-state.json`; future starts do not need the legacy flag. Preserve the same browser/server address to retain the original `emberwild-account` key. A changed host/port is a separate browser storage origin. The Emberwild pack retains the old token, roster and layout migrations. Check representative characters before changing your regular server.

Alternatively, set `DATA_DIR` to a separate copy of the old directory and use the same legacy flag. Never point two running servers at one JSON store. A world marker prevents accidental cross-world use; it is not a distributed lock.

## Updates and rollback

For supported additive content changes, dialogue, announcements and vendor stock, use the [live update workflow](LIVE_UPDATES.md). Connected players receive these changes without a normal restart. The maintenance procedure below applies to code, geometry, removals and other incompatible changes. Preserve `live-content.json` with saves; a changed baseline with accepted live updates requires the consolidation procedure in that guide.

Stop the server, back up saves, install the engine and compatible world releases, validate the pack, and restart. Check `/ready`, enter a representative saved character, and verify inventory/quests before inviting players. Retain the old engine/world artifacts with the backup. Content-version metadata does not automatically migrate arbitrary schema or content changes. Rolling back code can require rolling back its corresponding save snapshot; preserve the newer snapshot separately.

## Public hosting and scaling

The supplied setup is for local/LAN testing. For public hosting, terminate HTTPS/WSS at a reverse proxy, forward WebSocket upgrades, preserve the original Host/Origin relationship and configure appropriate timeouts. Do not trust arbitrary forwarded headers without configuring a trusted proxy boundary. Keep identity responses out of caches and redact authorization/session material from logs.

Browser bearer-key identities have no password, recovery or cross-device flow. Proper accounts, request/connection limits across HTTP endpoints, moderation/abuse controls and an operational security review remain public-service work. The existing WebSocket payload/message limits are a prototype foundation.

Run one simulation/store writer per save directory. More container replicas do not share a world, and sharing a JSON volume can lose data. [Architecture](ARCHITECTURE.md) describes the database, allocation and ownership work required before distributed scaling.

## Troubleshooting

- **Port already in use:** stop the other server, or use `PORT=3081 ./start.sh` / `PORT=3081 docker compose up` and open that port.
- **Friends cannot connect:** use the host's LAN address, check firewall rules, and allow the Docker LAN bind. Other machines' `localhost` refers to themselves.
- **WebGL startup error:** use a desktop browser with hardware acceleration and working graphics drivers. Browser automation may need an X display/software graphics on Linux.
- **World not found:** install its directory and `world.json`, or pass an absolute directory with `--world`. Emberwild is not included in the base engine repository/image.
- **Wrong-world save error:** choose a separate `DATA_DIR`. Do not edit the marker to make incompatible characters load.
- **Unmarked legacy saves:** follow the backup/adoption procedure above with the correct world.
- **Character access disappeared:** confirm browser profile and exact server URL. Clearing site storage loses the access key. Do not publish server saves while asking for help.
- **Readiness is failing:** inspect server logs, writable-volume permissions and available disk space. Failed saves should be resolved before players continue.

## KithCore naming and existing deployments

Engine downloads now extract into `kithcore/` and use the `kithcore:<version>` local image tag. Emberwild starter filenames include `-kithcore-<engine-version>`. The world IDs (`minimal`, `emberwild`), world versions, runtime API, save layout and browser identity namespaces remain unchanged by this rename.

If replacing an existing Compose deployment from a differently named folder, keep its existing Compose project name with `docker compose -p YOUR_EXISTING_PROJECT ...`; Compose uses that name to select its named save volume. Check the volume/mount before starting, and back up first. Changing the engine's directory name alone must not be used as a save migration. Existing backup directory/image names can be retained; the examples above use the new project name for fresh installations.
