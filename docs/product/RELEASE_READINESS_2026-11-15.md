# EFO Skill Lab — Release Milestone 1 Integration and QA Register
Date: 2026-11-15
Status: IN PROGRESS — DRAFT SOURCE ONLY, NOT MERGED OR RELEASED

## Baseline and scope
- `main` at review: `4b43c77f14a3aa73a7d8df48f2f0aa05fc543b77` (2026-11-09).
- Software-verified P25 draft source: `5af574ed815c6dd4b396b0212ff24074dff86eb8` (PR #65), with exact-head Linux and Windows Edge CI successes.
- Repository-wide hardening PR #68 source: `3b47fd30c8e9d2c9aedf2b2ae57507f8d5b6cba7`, a descendant of P25 and the starting parent of this work. PRs #66 and #67 are **alternative** QA branches, not automatically merged with #68.
- This work is isolated on `release/m1-qa-stabilization-2026-11-15`. No production changes, main merges, cloud/backend/auth/payment integrations or live PLC communications are approved.

## Reproduced CI finding and fix
- 2026-11-14 Linux run `43600084679` failed at the newly introduced `scripts/qa-share-code-browser.cjs` step. Log: route prototype negatives PASS; malformed candidate share code PASS; then `Valid candidate assignment had no start button`.
- Cause in the QA harness: Puppeteer `page.$eval('button', ...)` returns one element; test callback mistakenly treats it as an array. This masks the valid candidate flow and skips subsequent checks.
- Changed to `page.$$eval('button', ...)` to evaluate the actual collection. The candidate state transition remains a mandatory regression assertion; no checks are skipped, removed or weakened.
- The final new branch commit must receive an exact-head successful standard Linux pipeline before this fix is considered independently browser-verified. Local edit/source review is not the same as a passed browser run.
- The earlier PR #68 dedicated QA/coverage workflow completed successfully (1,351 native tests in 165 test files) and hosted Windows Edge completed successfully, but neither substitutes for the failed Linux browser gate.

## Milestone 1 actionable gates
- [ ] Confirm complete P1–P25 plus QA ancestry, reconcile overlapping PR #28–#68 changes and document superseded branches before a merge. No mass or automatic PR merge.
- [ ] Full final-head Linux CI: typecheck, Vitest, Vite/offline production build, bundle budgets, all original P1–P25 browser scenarios, new untrusted-code browser check, accessibility, Firefox/WebKit, no-WebGL.
- [ ] Full final-head hosted Windows Edge and independent QA/security/coverage workflows.
- [ ] Review trust boundaries for untrusted projects, result/assignment payloads, local progress, prototype-safe route lookup, shared codes, storage, worker commands and resource limits. Keep assessments explicitly unauthenticated.
- [ ] Improve sandbox project durability beyond the current single `localStorage` autosave key, including tested recoverable snapshots, safe import failure behavior, storage quota and cross-tab conflict detection.
- [ ] Verify offline reload, cache update and recovery under storage/browser failure with evidence.
- [ ] Prepare owner review of the integrated release-candidate diff; no merge until all required acceptance is explicitly approved.

## Later release gates (tracked, not claimed complete)
- [ ] Genuine physical Windows 8GB/no-dGPU WebGL/performance measurement and manual Chrome/Edge/Firefox/Safari/mobile accessibility.
- [ ] Independent controls engineer evaluation of PLC scan/IEC teaching subset, plant/electrical/three-phase model accuracy and clearly bounded non-safety-rated claims.
- [ ] Instructor and student exercises/usability tests; validate outcomes and scoring. Local employer result codes are editable, not trusted certifications.
- [ ] Long-running multi-PLC/multi-plant endurance and persistence/restore tests.
- [ ] Current pinned dependency/SBOM, asset provenance, third-party licensing and legal/security signoff.
- [ ] Owner-approved scope, documentation/versioning, exact final release candidate and explicit GO.

## Acceptance rule
Automated success on a development branch proves only that branch's software tests passed. It does **not** imply main integration, physical-machine acceptance, real PLC fidelity, certification, licensing clearance, data durability, security signoff or release authorization.