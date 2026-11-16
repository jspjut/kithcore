# Local developer explorers

Enable the developer entry explicitly on a local Node server. For an isolated Emberwild save directory:

```sh
ENABLE_DEVELOPER_MODE=1 HOST=127.0.0.1 DATA_DIR=./data/emberwild-dev ./start.sh --world emberwild
```

Open `http://localhost:3080/developer` (use the port you selected). Create a character with the usual race, class and appearance controls. New characters created here are **GM explorers**. This entry keeps its browser account/roster separate from the normal `/` entry.

In Emberwild, a GM explorer starts with every flight stone and capital portal discovered. Open **Travel**, search for a zone/city, and choose **Explore** to travel there instantly from anywhere. Ordinary flight and portal buttons remain available at stations. Discoveries and the GM role persist, and newly added travel stones are unlocked on the next login. This is an exploration role; it adds no quest rewards, XP or world-editing interface. Worlds without a flight network retain their existing travel UI.

Developer access is disabled by default. Both character creation and GM login require the server flag and a direct loopback connection. Forwarded/proxied requests are rejected. GM characters cannot enter through the normal page or while developer mode is disabled. The ordinary character API ignores client-supplied role flags. The `/developer` URL alone grants no permissions.

The data directory option is optional, but a separate directory makes it easy to explore without mixing development characters into a regular world. Existing saves are not migrated or deleted by enabling this entry.

Run `node --test tests/developer.test.js` for access/creation/persistence checks. With Emberwild installed and Playwright available, `node tools/atlas-browser.js --world emberwild` checks actual GM creation, travel, atlas navigation, non-overlapping labels, logout/resume and separation from a normal roster against disposable saves. It writes screenshots under ignored `test-results/`.

The Travel window is spatial: select a stone on the flight map (or search and select a highlighted match), then use **GM: Explore** to jump there. Ordinary characters see route previews and must discover stones on foot; they never receive the GM action.

The world atlas supports cursor-centered wheel zoom and dragging to pan. Zooming into a charted region opens its finer chart; zooming out from a fitted chart opens its parent. A continuous wheel gesture changes at most one hierarchy level; pause briefly before continuing into the next. Zone charts can be enlarged up to 4×. Breadcrumbs, right-click, and keyboard navigation remain available. Flight-map dragging suppresses text selection without affecting the search field.

Flight movement uses the server-selected route and timing in each transit snapshot. The client samples that same arc-length path every frame and gradually corrects timing differences; it extrapolates at most half a second beyond the latest snapshot before waiting for the server. Arrival, interruptions, and movement permissions remain authoritative. Motion epochs and session resets discard the flight presentation. Remote travelers use snapshot interpolation with a flight-speed-aware teleport threshold. Regression coverage includes `tests/flight-presentation.test.js`, Emberwild’s netcode/travel tests, and `tools/flight-map-browser.js` (which drops two out of three state snapshots).
