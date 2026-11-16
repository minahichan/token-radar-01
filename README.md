# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Minahichan/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Minahichan/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar — which pre-token protocol is worth farming next, and what to do about it. It reads a sealed DefiLlama snapshot of every protocol the service tracks, finds the ones that record no token yet, ranks them by an implied launch value, and hands you a dashboard with the board, a detail view for every protocol, and a six-step farm plan each.

The implied value is this radar's own claim, computed only from the snapshot's figures: a protocol's TVL times the market-cap / TVL multiple that live-token protocols in the same category actually trade at, adjusted for 7-day growth, tenure with no token, and chain reach. Nothing is hardcoded by name — the same four factors score every row — and the dashboard recomputes each value in the page so the board and the code always agree.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22.18 or later, standard library only — nothing to install. `main.ts` reads the snapshot, writes the ranked board to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json`. Open `out/dashboard/index.html` in a browser (it renders with no network). The board covers all 40 watchlist protocols plus every other rankable pre-token protocol below the floor — 198 rows on this snapshot.

---

<sub>Entered on [make.fun](https://make.fun/?ref=60xrk087&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
