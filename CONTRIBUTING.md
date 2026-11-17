# Contributing to EFO Skill Lab

Read `CLAUDE.md` first, then `docs/product/STATUS.md` (what is verified now) and `docs/product/MASTER_ROADMAP.md` (the one forward plan; stage order is binding). Older P1–P25 and UX records are history, not a backlog.

## Ground rules

- Frontend-only. No backend, accounts, cloud sync, payments or industrial network access.
- The worker is the only simulation authority; the UI sends commands and draws snapshots. Simulation code is pure, deterministic (seeded RNG, 50 ms scan, 10 ms plant substeps) and DOM-free.
- Original assets only. Never claim safety rating, physical accuracy or equivalence with any commercial product.
- Small PRs, honest claims, no per-task report files: update `STATUS.md` and the one relevant guide.

## Adding equipment or a PLC instruction

Follow `docs/product/DEVICE_CONTRACT.md` (devices) and `docs/product/PLC_SUBSET.md` (instructions). Required for every addition: tests for each behaviour, a determinism replay, save/reload and removal, a deliberate-break check (break the rule, see a test fail, restore), a real-browser test built from an empty floor, and regenerated docs (`UPDATE_DEVICE_CATALOG=1 npx vitest run tests/device-catalog-doc.test.ts`). New `FaultKind`s are appended, never reordered.

## Verify before opening a PR

Run in a **clean install, before installing Puppeteer**, because Puppeteer's transitive typings hide errors CI will report:

```bash
npm ci && npx tsc --noEmit && npm test && npm run build && npm run verify:full && node scripts/check-performance-budgets.cjs
```

Then install Puppeteer (`npm install --no-save puppeteer@24.31.0 axe-core@4.10.3`) and run the relevant browser scripts with `PLC_BASE_URL=http://127.0.0.1:4173 node scripts/<script>.cjs` against `npx vite preview --port 4173`. A script that only passes on retry is *flaky*, not fixed.

## Labels and ownership

Use the PR template. Suggested labels: `area:workbench`, `area:project-library`, `area:plc`, `area:electrical`, `area:plant`, `area:learning`, `area:docs`, `gate:owner` (needs a human or device the repo cannot supply), `risk:data` (touches saved projects).
