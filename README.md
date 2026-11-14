# Afterglow — Before the ticker

An original offline token launch research radar for token-radar-01. It ranks **192 real protocols**, preserves **40/40 house watchlist names**, discovers **134 below-floor leads**, and sets aside **416 recorded-token protocols** from the sealed 758-protocol snapshot.

## Run

Use an official Node.js 22.18+ build with native TypeScript support. No installation, API key, third-party package or network is needed at runtime.

```sh
node main.ts --input ../../kits/token-radar-01-kit/input/snapshot.json --output out
node --test tests/*.test.mjs
```

In the grading container, `node main.ts` defaults to `/input/snapshot.json` and `/output`. `MAKEFUN_OUTPUT_DIR` and `--input <file|directory>` / `--output <directory>` support local builds. Open **out/dashboard/index.html** directly in a browser. Keep its sibling **out/data.js** in place. Generated outputs are committed for immediate review.

This host's `/usr/bin/node` is compiled without TypeScript support despite reporting 22.22.1. Verification used the official Node 22.22.1 binary in the ignored `.tools/node-v22.22.1-linux-x64/bin/node`. This machine-specific tool is not shipped or needed by the competition runtime.

## What works

- A sortable, paginated value board, protocol/chain search, category/chain/momentum filters, house watchlist, below-floor scope, local saved shortlist and CSV export.
- An inspector for every lead with raw observed metrics, the full valuation equation, assumption range and peer evidence.
- Five category-specific farm steps with concrete test actions, principal, fee ceilings, duration and exit checks. Capital and fee assumptions can be edited; checklists persist locally. Restricted-access categories stay in research mode with zero funded capital.
- A filtered logarithmic scatter plot, a transparent methodology dialog, keyboard focus and `/` search shortcut. Mobile retains a horizontally scrollable data table.

## Model

`dashboard/model.js` runs unchanged in Node and the page. `prepare` calibrates category and global circulating-market-cap/TVL quartiles from positive-cap recorded-token peers, excluding exchange, bridge and wrapped/staking-product categories. Ratios are clipped to 0.05–5×. `rank` uses:

```
category weight = n / (n + 5)
multiple = weight * category median + (1 - weight) * global median
implied market cap = TVL * multiple * growth * maturity
growth = 1 + clamp(change_7d, -50, 50) / 200
maturity = 0.70 + 0.30 * min(tracking_days / 730, 1)
```

Missing growth uses 1× and missing tracking history uses 0.85×. Low/high bands blend peer quartiles, impose at least a 20% median spread, apply 0.70/1.30 scenario factors and widen for missing fields. They are assumption scenarios, not confidence intervals. Slug is the deterministic tie-breaker. No current clock, random input or network is used.

The watchlist is always retained. Extra no-token-record candidates pass category, version/name and exchange-name exclusions. Parent relationships are absent from the snapshot, so discovery leads can still include subsidiaries or versions. Farm plans are category-based hypotheses, not independently verified protocol instructions.

## Evidence and limitations

The sealed data was fetched from DefiLlama at **2026-11-14T01:18:33.201Z**. Its SHA-256 is stored in board.json. A missing token record does not establish token absence. Tracking age is not launch age or proven time without a token. TVL is not revenue, token rights or unique capital and may overlap across protocols; modeled values must not be summed. The model is a conditional circulating market-cap proxy, not FDV, reward value, launch probability or a launch date. No campaign, eligibility, audits, fees or points are verified. Dollar budgets and time horizons are explicit planning assumptions.

## Artifacts and verification

- `main.ts`, `dashboard/`, and unmodified kit `vendor/makefun-board.ts` implement the entry.
- `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`, `out/dossier.json` are actual generated outputs.
- `screenshots/1-board.jpg`, `2-detail.jpg`, `3-filtered.jpg` are genuine Chrome CDP captures, not reconstructed illustrations.
- `tests/` verifies coverage, real values, deterministic ranks, meaningful model sensitivity, missing data, farm budgets, canonical dossier, source limits and two byte-identical complete runs.
- `tools/browser-qa.mjs` uses native Node WebSocket against local CDP (`RADAR_CDP`, default port 9222), creates/closes only its own tab, blocks HTTP(S), exercises all 192 inspectors and captures three real screenshots. It is a development tool; runtime never starts a browser. Build `--preview` before recapturing, then run a full build afterwards.
- `evidence/browser-qa.json` and `evidence/screenshots.json` record actual checks and captures. `evidence/verification.json` records output hashes and dimensions.

This is local work only. No remote, transcript bundle, entry submission or publication has been created. A transcript/package/site check remains the parent session's responsibility; the sealed judge and scorer are server-only.

License: MIT. Copyright Arybil. Native build session: `20261114_122428_4af4b1`.
