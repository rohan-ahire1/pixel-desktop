# Feature map

What exists in this repo and what proves it works. Agents read this before changing anything and update it when they add, move or remove a feature.

| Feature | Where (route, screen or module) | Source | Proof (test, command or route to screenshot) |
|---|---|---|---|
| Coffee Panic boot film | desktop first visit | `js/film/coffee-panic.js`, `js/film/player.js`, `js/boot.js` | `scripts/film-browser.mjs`, `scripts/film-smoke.mjs` |
| One Cut reel and end card | Watch the reel icon, Welcome button | `js/film/one-cut.js`, `js/film/one-cut-scenes.js`, `js/apps/reel.js` | `scripts/film-browser.mjs`, `scripts/film-smoke.mjs` |
| Desktop shell | `/` | `js/main.js`, `js/desktop.js`, `js/wm.js` | `node .factory/verify.mjs --start --shots /` |
| Phone site | `/phone.html` | `js/phone.js` | `node .factory/verify.mjs --start --shots /phone.html` |

## Out of bounds

None set in `factory.json`. Do not deploy unless asked.
