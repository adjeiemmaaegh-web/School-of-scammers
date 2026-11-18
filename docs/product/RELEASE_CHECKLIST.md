# Release go / no-go checklist (roadmap R12.3, R12.4)

**Rule:** any unchecked owner gate means NO-GO for an unrestricted release or any claim of physical, educational or safety suitability. Automated evidence is necessary, not sufficient. This file records the state; it never approves a release, and nothing here deploys anything.

Candidate commit: `_______________` (fill in the exact SHA; everything below must be re-verified on that SHA)

## A. Automated gates (the repository can produce these)

| Gate | How | State |
|---|---|---|
| Typecheck, unit tests, production build, offline build | `npm ci && npx tsc --noEmit && npm test && npm run build && npm run verify:full` run in a clean install before Puppeteer | see `STATUS.md` for the last recorded run |
| Bundle budgets | `node scripts/check-performance-budgets.cjs` (sandbox route headroom is low: see F-21) | |
| Full browser matrix, no retries | every script listed in `.github/workflows/ci.yml`; archive in `docs/qa/r12/` | |
| Linux + Windows Edge + repository QA workflows green on the exact SHA | GitHub Actions run links in `STATUS.md` | |
| Dependency audit disclosed | `npm audit` (F-18) | |
| SBOM and asset provenance | produced by the CI "qa-artifacts" step; `docs/LICENSE_PROVENANCE_REVIEW_2026-11-05.md`, `docs/DEPENDENCY_LICENSE_TRIAGE_2026-11-06.md` | formal legal clearance NOT given |

## B. Owner-only gates (cannot be closed by the repository)

| Gate | Evidence to attach | Done / by / date |
|---|---|---|
| Physical Windows laptop, 8 GB RAM, no discrete GPU: startup, FPS, input latency, memory, scan timing on a large scene | measured numbers and the machine description | ☐ |
| Real Chrome, Edge, Firefox and Safari manual passes, desktop and tablet | tester notes | ☐ |
| Assistive-technology pass (screen reader, keyboard only, zoom, high contrast) | tester notes | ☐ |
| Independent controls/electrical engineer review of the scan model, I/O isolation, wiring consequences, process limits and terminology | signed review | ☐ |
| Instructor and student trials from a blank workspace without help | completion, friction and false-scoring notes | ☐ |
| Third-party licence, font, asset and redistribution clearance | written clearance | ☐ |
| Owner approval of PC/tablet UX against the R1 screenshots (`docs/qa/r1/`) | sign-off | ☐ |
| Vercel production deployment maps to the approved SHA (the 2026-11-17 rate-limit status must be resolved) | deployment URL and commit | ☐ |
| Rollback rehearsed (`BETA_PACKAGE.md`) | note | ☐ |
| **Explicit owner GO** | signature and date | ☐ |

## C. Not claimed even after GO

Not safety-rated; not calibrated or physically accurate; no vendor PLC, TIA Portal or Factory I/O equivalence; no real PLC or fieldbus connection; assessment codes are editable local data and are not certificates.
