# Steady Guide — Engineering development checkpoint

**Branch:** `feature/steady-guide` (created from `main` at `4eb3cd1a355ba708287a2ce1ddb9376b58abd70a`).
**Product plan:** the previously supplied architecture file STEADY_GUIDE_ARCHITECTURE_2026-11-19.md was delivered in the project conversation; it is not committed to the repository.
**Status:** Development branch only. Unmerged, no production release authorization.

## Implemented on this branch

- Distinct `/guide/*` lazy route, prominent header/Home/Learn entry and Help menu shortcuts in the existing Simulator.
- Typed beginner walkthroughs for orientation, first 24 V lamp, workbench, wiring, PLC programming, languages/PID, factory scenes, diagnostics and backup.
- Searchable equipment reference with exact 54 registry keys, terminal names/roles, family filters and model limitations; no new device engine.
- Searchable atlas for all 21 original scenes using lightweight, source-checked titles/descriptions and real scene metadata; no reference solution/answer injection.
- Existing lesson/scenario/course links reused; no duplicate grader or hidden-fault hints.
- Local progress via dedicated, bounded `efo-steady-guide-progress-v1` key; no project, IndexedDB or assessment mutations performed by the guide.
- Fourteen authentic screenshot states are scripted as CI review artifacts (not automatically published or automatically accepted). The earlier eight-state browser capture from commit `f280fc5e` was verified and reviewed; the expanded capture suite is a new test gate. Five genuine 2026-11-17/18 R1 workbench PNG screenshots (the original repository QA blobs) copied to first-party public assets; with visible source and viewport labels. **Not yet owner-approved and not recaptured at this new commit.**
- Six goal-based beginner equipment plans with real registered devices, safe scope limits and links to existing scenes/scenarios; build plans never apply actions to a project.
- Eight opt-in, read-only workbench spotlight targets that point out active controls without clicking them; the optional drawer closes on Escape and restores focus.
- Source-parity tests, progress parser tests, authoritative first-lamp worker tests, and browser smoke for navigation, contextual drawer/Escape/highlight cleanup, screenshot load, six build plans, device/scene coverage, safe project keys and mobile layout.

## Must complete before feature release

1. Run exact-head TypeScript, unit, offline, budget, browser and CI checks. Inspect preview and fix regressions.
2. Finish source-grounded additional captures SG-01..SG-18, especially actual equipment/Inspector/PLC/FBD/diagnostics/project-library screenshots and tablet/mobile variants; record app SHA, viewport, state and alt text. The five R1 captures only cover workbench context.
3. Review beginner copy and the worker-tested first-lamp circuit with a novice; the unit/worker proof exists but real novice usability and live browser placement/wiring acceptance remain owner/unverified gates.
4. Validate the newly implemented contextual Help drawer and read-only spotlight at every view, including closed-panels fallback, Escape/focus restoration and no project edits on the exact PR head.
5. Validate offline first-use cache size, screenshot media budget and low-resource browser behavior, plus WCAG manual review.
6. Preserve existing release NO-GO: physical low-spec machine, cross-browser, controls reviewer, user trials and licensing remain owner gates. Merging `main` would automatically deploy production, so require explicit release approval.

## Security and model limits

Steady Guide does not issue worker commands, create/overwrite projects, load hidden faults, change assessment scores or use arbitrary HTML. All navigation uses static reviewed internal routes. It teaches the educational model, not rated industrial wiring. Guidance must never imply vendor hardware equivalence.

## R13 budget checkpoint (2026-11-19)

At commit `951f2af9`, Vite/typecheck and Vitest passed, but the aggregate (all lazy chunks summed) JavaScript gzip size measured **870,813 bytes**, 413 bytes above the prior 850 KiB (870,400 B) limit. The active simulator route remained **501,756 bytes / 575 KiB**. We keep the simulator entry, renderer and critical-path caps unchanged; adjust only the all-JS ceiling by **2 KiB** to 852 KiB, and add an explicit **150 KiB** budget for the new lazy Guide initial route. These are bundle-size proxies and do not establish actual low-spec responsiveness. Check exact-head CI before accepting this adjustment.

## CI regression fixes in this branch

- Updated the route-integrity checker to understand `/guide/*` and include Guide source paths.
- Kept the existing UX2 assembly-library selector aligned with the already-shipped R1 palette layout rather than reintroducing old UI.
- Fixed a TypeScript literal-union test set and a Puppeteer `$eval`/`$$eval` selector-count mistake in new Steady Guide tests; these were test defects caught by CI.
- The root npm 10 install of `@vitest/coverage-v8@5.1.0` failed reproducibly with `Cannot read properties of null (reading 'edgesOut')` (optional peer resolver). Isolated installation with `--legacy-peer-deps` and a symlink to pinned project Vitest produced a **passing** full native-coverage job at commit `404e2a59`; continue checking on final head.

## Reconciliation increment — 2026-11-20

- Integrated the newest `main@7aaeee92201dfbba25d22b74ca9ae77b3f52cd53` into this draft branch without writing to `main`. The feature's previous head is preserved at `backup/steady-guide-pre-main-reconcile-2026-11-20`.
- Retained UX7 wide-screen workbench geometry, UX8 component/assembly library tabs, newer theme icon and current UX2 browser selectors. Preserved Steady Guide routes, read-only contextual drawer, help links, 54-device index, 21 scenes, build plans and all source screenshots.
- Corrected collection-count browser assertions that previously used Puppeteer `$eval` (single element) instead of `$$eval` (list); previous exact-head build CI failed with `undefined !== 6` in the Steady Guide browser step. Added an integration assertion for the existing UX8 Assemblies tab.
- This is a development reconciliation, **not** acceptance. Require new exact-head CI (including browser, coverage and offline), visual capture reviews, novice and controls-engineer assessment, owner release gates and explicit approval before any `main` merge.

## Screenshot/keyboard continuation — 2026-11-20

- Expanded authentic Chromium screenshot capture from 14 review states to 23, with a separate **real, six-device, eleven-wire worker project**, selected motor Inspector, genuine LD/ST/FBD editors, simulated supply-meter probing and the 21-scene atlas. Empty-state captures remain explicitly labeled. Full SG-10 timer/PID, SG-11 FBD compilation, SG-14/15/17 and device acceptance are **not** claimed. Every PNG is hashed and linked to checked-out Git source, with human approval still pending.
- Extended Steady Guide browser checks for the collapsed-Inspector fallback spotlight, keyboard focus restoration on Escape, and no project-storage mutation from contextual help. Updated the R1 screenshot reading key so it no longer falsely claims the older screenshot contains the new Steady Guide nav item.
- The capture job checks source-driven browser state, not visual design correctness. Screenshot approval still requires owner/novice/controls review and accessibility checks. Changes remain on the draft branch with no production merge/deploy authorization.

### Exact-head CI feedback (2026-11-20)

- Commit `8735ee32` passed its repo QA/security and native coverage; full build passed before browser checks, but its **Steady Guide browser step failed**. The drawer highlighted the Inspector fallback before React asynchronously updated the live status text. The test incorrectly asserted the old introductory status immediately after the highlight. This continuation waits for the real status announcement; it does not mask missing fallback content.
- Populated screenshot evidence IDs are now suffixed `-populated` and include a canonical `subjectId`, so original empty-state and populated-state evidence cannot collide in a manifest. The capture script asserts unique IDs.
- The 23-state screenshot run did **not** execute on `8735ee32` because GitHub Actions stopped at the browser failure. A new exact-head run is required to validate capture code. No release approval.

### Second screenshot capture CI failure and fix (2026-11-20)

- `c7c0a489` browser smoke passed the new status/focus/storage checks, but 23-state screenshot capture stopped after staging the six-device project. The selected-device inspector has a different markup path from its empty-state checklist: `.sandbox-inspector-top h2` vs `.sandbox-inspector-heading h2`. The test was waiting for the nonexistent empty-state heading on a populated device and timed out at script line 100.
- The corrected capture check now asserts the populated Inspector title, exact selected `motor-4` device ID and its real model-limit explanation. No simulated component implementation was changed.
- CI uploads the raw evidence folder immediately after the screenshot step even when later acceptance fails; missing/partial manifests remain visibly unapproved. Next exact-head run must reach and verify the entire 23-image recipe.

### R13 readability increment — original visual artifact review (2026-11-20)

- Downloaded the successful `2139c994` screenshot artifact and independently checked 23/23 PNG hashes and 23 unique IDs. The real project and 24 V meter are genuine, but full-window views made the bottom-docked Ladder/ST/FBD/meter interfaces partially truncated or too small for instructional illustrations.
- Updated capture source to preserve the original 23 context images and add five real DOM element captures (Inspector, Ladder, ST, FBD and two-probe DC meter) directly from Chromium, with parent-image provenance and native geometry. Scene atlas starts at its heading instead of a mid-list scroll position. **28-state recipe is newly authored; not yet executed.**
- No AI-generated fake screenshots, source project mutations outside an isolated QA browser, automatic public promotion, owner screenshot signoff or merge/deploy authorization.

### Visible pane capture remediation (2026-11-20)

- The `d72451b3` **28-file manifest and PNG hashes passed**, but independent image inspection revealed incorrectly framed focus crops of scrolled engineering panes. The raw PNG data were authentic; subject alignment was not acceptable.
- Corrected focus capture to enlarge the real dock/Inspector using actual user-facing range controls, scroll the actual editor into its own clipped workbench pane, and take a viewport clip of the genuinely visible pane instead of requesting an offscreen whole-element capture. Added explicit pane-source metadata and limited visible-pane ALT/scope wording.
- Automated capture success is only a provenance/state gate. Final selected screenshot visual acceptability still requires inspection of the new resulting five images; no production or owner approval.

## Beginner navigation and reset-safety continuation — 2026-11-20

- On mobile screens, the twelve Guide sections are now accessible from a compact, keyboard-operable disclosure control with real `aria-controls` / `aria-expanded`. Desktop navigation stays visible and the mobile list collapses after selecting a destination. This does not mutate project storage or run simulation commands.
- Reading-progress reset is **two-step**: a review prompt offers **Keep progress** or **Clear guide progress**, preserving the previous completion until explicit confirmation. Focus returns to the reset trigger after either choice. The action affects only the Steady Guide reading-progress storage key.
- Guide-wide equipment search now recognizes lightweight learner names including **24V pilot lamp, proximity sensor, 24V supply, START NO pushbutton**, and surfaces a clear no-results message without importing the large simulator component registry into the Guide landing bundle. Unit tests validate vocabulary keys and examples.
- Chromium smoke now tests mobile disclosure navigation, reset cancel/confirm and isolated project storage, and search by accessible labels. Existing axe automation expands to five Steady Guide routes, but automated scans are **not** WCAG certification.
- Changes are confined to the open draft PR #89. All exact-head TypeScript, native, browser, performance-budget, Windows, cross-browser and screenshot checks must pass before describing development verification as complete. Novice, controls-engineer, physical low-spec hardware, screenshot publication and owner approval gates remain open. No merge or deployment.

## First-lamp source-of-truth and real browser journey — 2026-11-20

- The `/guide/topic/first-lamp` walkthrough and `/guide/builds/first-lamp` use the same static, type-checked, named-terminal reference. The accessible three-wire checklist is `24V supply P24 → START NO A`, `START NO B → 24V pilot lamp L+`, `pilot lamp M- → supply M0`. **Educational virtual 24 V only**; never claim real-world electrical safety.
- Tests compare every advertised endpoint to an existing component registry terminal. The original native worker behavior tests now derive their wires from the same instructional source, preventing silent Guide-vs-worker drift.
- New `scripts/steady-guide-first-lamp-browser.cjs` starts from the actual Guide route, follows its Simulator link without resetting project data, searches and places the three devices through their UI controls in a fresh browser profile, connects the three exact terminal pairs, verifies the real worker lamp **OFF → ILLUMINATED → OFF**, then removes the START-to-lamp wire and proves that pressing START no longer illuminates the lamp. It returns to the Guide and checks the saved project has not changed.
- The browser recipe uses a disposable isolated browser context, not a graded work order or hidden assessment answers. It never injects a pre-solved project. It runs in GitHub CI separately from the existing R9 guided starter and source-only native test.
- This is development testing, not manual novice acceptance, qualified electrician review, actual 24 V hardware proof, calibrated measurement or certified safety. No explicit owner release/deployment approval; PR remains DRAFT.
