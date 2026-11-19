# Steady Guide — Engineering development checkpoint

**Branch:** `feature/steady-guide` (created from `main` at `4eb3cd1a355ba708287a2ce1ddb9376b58abd70a`).
**Product plan:** the owner-approved architecture file STEADY_GUIDE_ARCHITECTURE_2026-11-19.md was delivered in the project conversation; it is not committed to the repository.
**Status:** Development branch only. Unmerged, no production release authorization.

## Implemented on this branch

- Distinct `/guide/*` lazy route, prominent header/Home/Learn entry and Help menu shortcuts in the existing Simulator.
- Typed beginner walkthroughs for orientation, first 24 V lamp, workbench, wiring, PLC programming, languages/PID, factory scenes, diagnostics and backup.
- Searchable equipment reference with exact 54 registry keys, terminal names/roles, family filters and model limitations; no new device engine.
- Searchable atlas for all 21 original scenes using lightweight, source-checked titles/descriptions and real scene metadata; no reference solution/answer injection.
- Existing lesson/scenario/course links reused; no duplicate grader or hidden-fault hints.
- Local progress via dedicated, bounded `efo-steady-guide-progress-v1` key; no project, IndexedDB or assessment mutations performed by the guide.
- Five genuine 2026-11-17/18 R1 workbench PNG screenshots (the original repository QA blobs) copied to first-party public assets; with visible source and viewport labels. **Not yet owner-approved and not recaptured at this new commit.**
- Source-parity tests, progress parser tests and a browser smoke for navigation, screenshot load, device/scene coverage, safe project keys and mobile layout.

## Must complete before feature release

1. Run exact-head TypeScript, unit, offline, budget, browser and CI checks. Inspect preview and fix regressions.
2. Finish source-grounded additional captures SG-01..SG-18, especially actual equipment/Inspector/PLC/FBD/diagnostics/project-library screenshots and tablet/mobile variants; record app SHA, viewport, state and alt text. The five R1 captures only cover workbench context.
3. Review copy and verify the first-lamp circuit in the authoritative worker using a browser job (not prose-only); obtain novice usability feedback.
4. Provide fully tested optional contextual help sheet with keyboard Escape/focus-return/anchor fallback (currently the Help menu uses safe deep links).
5. Validate offline first-use cache size, screenshot media budget and low-resource browser behavior, plus WCAG manual review.
6. Preserve existing release NO-GO: physical low-spec machine, cross-browser, controls reviewer, user trials and licensing remain owner gates. Merging `main` would automatically deploy production, so require explicit release approval.

## Security and model limits

Steady Guide does not issue worker commands, create/overwrite projects, load hidden faults, change assessment scores or use arbitrary HTML. All navigation uses static reviewed internal routes. It teaches the educational model, not rated industrial wiring. Guidance must never imply vendor hardware equivalence.
