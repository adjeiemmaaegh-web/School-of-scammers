## What changed and why

## Roadmap task(s)
<!-- e.g. R2.4, with the state you are claiming: IMPLEMENTED_UNVERIFIED / CI_VERIFIED -->

## Evidence
- [ ] `npm ci && npx tsc --noEmit && npm test && npm run build && npm run verify:full` (clean install, before Puppeteer)
- [ ] Budgets: `node scripts/check-performance-budgets.cjs`
- [ ] New or changed behaviour has unit tests, a determinism replay and a deliberate-break check
- [ ] Browser script(s) run without retries: ...
- [ ] Docs regenerated/updated (STATUS.md, DEVICE_CATALOG.md, PLC_SUBSET.md as relevant)

## Data and compatibility
Saved projects, `formatVersion`, library records, localStorage keys: unchanged / changed (explain and add a migration test).

## Not done / not claimed
<!-- Owner-only gates, known limits, anything unverified. No safety, accuracy or product-equivalence claims. -->
