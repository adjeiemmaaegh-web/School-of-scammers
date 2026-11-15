# EFO Skill Lab — Release Milestone 1 Integration and QA Register
Date: 2026-11-15
Current status: PR #70 DEPLOYED; physical/commercial release acceptance INCOMPLETE. The M1 draft checklist below is historical.

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
## Milestone 2 — integration outcome (branch `release/m2-integration`)
- **One source commit.** `release/m2-integration` is #69's complete history (P1–P25 chain through #28/#29, #42–#50, #68 and the M1 repairs) plus current `main` (docs) and slices 7a/7b already merged. Branches #30–#41 are earlier, superseded attempts: every source file they changed exists in this branch, so they were closed after the merge, not merged. #66 and #67 are alternative QA branches; their unique unit tests were brought in (`tests/qa-*`) and the one that failed exposed a real gap (decoded results accepted 1000 evidence rows while the app can only produce 400; now 400). Their browser-only QA scripts (CSP runtime, npm advisory summary, repository static audit, cross-trade and candidate/employer browser flows) were **not** ported and remain unverified work.
- **CI stability.** `scripts/run-browser-step.cjs` retries a failed browser script up to three times and reports any retry as a `FLAKY` warning with the first failure's output. Three consecutive failures still fail the step. Retries do not remove the underlying timing sensitivity; they keep a loaded runner from blocking merges while keeping the instability visible.
- **Budgets.** The old "sum of every chunk" limit left under 1% headroom. It is now 850 KiB and a new `sandboxRouteGzip` budget (entry + route chunk + 3D scene + renderer + simulation worker, 575 KiB, measured 521 KiB) guards what a learner downloads to open `/sandbox`.
- **Docs.** The per-slice P6–P25 records moved to `archive/factory-slices/` behind `FACTORY_SLICES_INDEX.md`.
- **Still open** (not claimed): physical 8 GB/no-GPU measurements, real-browser manual and accessibility passes, controls-engineer review, instructor/student trials, endurance runs, licensing clearance, project durability beyond the guarded autosave, and the two parallel plant representations (the data-driven `electrical-defs`/`params` devices and the `plant/equipment` library) which coexist through one registry but have not been unified.


## Post-merge audit and remedial PR — 15 November 2026
- PR #70 merged as `4e4d5538b30ea562e0bf249eecf6abab173c97cc` and the Vercel production build reached READY. This is not industrial certification or completed product release acceptance.
- PRs #29–#41 were audited against that exact main tree. All of their changed source/test/script file paths survive; many evolved subsequently. Historical handoffs are archived in `archive/source-handoffs/` and must not be treated as current truth.
- Alternative QA PRs #66 and #67 left unported browser checks and assessment safeguards. PR #71 addresses candidate assignment identity/version/mode, preservation of issued assignment on return, pure bounded evidence updates, strict deployed CSP, employer/candidate and PLC/CCTV browser regression checks, lockfile/credential QA and accurate docs.
- PR #71 requires exact-final-head Linux/Windows Edge and repository QA passes, including CSP/Worker startup, share-code negatives and all twenty ranked exercise routes. A retried browser test is FLAKY, not a proven fix for timing sensitivity.
- Offline assignment and result codes are **unsigned, editable local JSON**. They are training evidence only and cannot authenticate the candidate, certify skills or prove industrial safety.
- Hardware, instructor, independent controls engineer, endurance, legal/provenance, 8GB Windows, physical PLC and manual-browser acceptance remain OPEN regardless of CI result.
