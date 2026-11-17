# Beta package: what a user (and a reviewer) can rely on

Roadmap R12.1. This describes the educational beta *as built*. It is **not** a release approval: the owner-only gates at the end are open, and until they are closed there is no unrestricted-release claim.

## What it is

A browser-based virtual industrial-automation simulator for learning: build a 24 V control panel and plant from a component library, wire real terminals, program PLCs in Ladder, Structured Text or FBD, run on a deterministic 50 ms scan, observe, break and repair. Runs fully in the browser; works offline after the first load.

## Not claimed

Not safety-rated; not physically accurate or calibrated; not a vendor PLC, TIA Portal or Factory I/O replacement; no real PLC, fieldbus or network connection; assessment codes are editable local data, not certificates. Every device states its own limits in the inspector (`src/components/model-limits.ts`) and in `DEVICE_CATALOG.md`.

## Privacy

No account, no server storage, no analytics or tracking in the app. Projects, versions, preferences and assessment progress live in this browser (localStorage and IndexedDB) and leave the device only when the user exports a file. Clearing site data deletes them.

## Backup, restore and rollback (for users)

- **Back up:** Project menu → Project library… → *Back up all* (one JSON file with every project) or *Export* per project; *Download project JSON* for the open project.
- **Restore:** Project library → *Restore backup* or *Import project JSON* (the older single-project file also works). Imported projects are validated and size-capped; nothing is opened until you choose.
- **Undo a bad edit:** Undo; or *Save version* before risky changes and *Restore* it later (the state it replaces is kept as a version).
- **Two tabs:** the second tab to save is told about the conflict and may keep its copy as a new project; nothing is silently overwritten.
- **If saving is blocked** (private mode, storage full): the page says so and the working copy is kept as far as the browser allows; export JSON.

## Offline

First visit must be online. After that the app starts offline. A newer build waits and shows "A new version is ready": reload when convenient; your project is already saved.

## Rollback (for maintainers)

Deployments are static builds on Vercel from `main`. Roll back with Vercel "Promote" of the previous production deployment (or revert the merge commit on `main`). Saved projects are not affected: `ProjectFile.formatVersion` is unchanged (1) and the library schema is versioned; a build that cannot read a newer record leaves it untouched and says so. Confirm the live deployment's commit equals the approved SHA after every change (the 2026-11-17 Vercel status for `284ba478` was a platform rate limit, not a code failure).

## Feature matrix (see STATUS.md for evidence)

| Area | State |
|---|---|
| 3D/2D/logical workbench, tools, panels | Built; owner UX review pending |
| Project library, versions, backup | Built; real-device storage acceptance pending |
| Ladder, ST (with timers/counters), FBD | Built; see PLC_SUBSET.md; controls-engineer review pending |
| 54 device kinds, 21 scenes, 4 graded scenarios, 20 ranked exercises | Built; instructor/student validation pending |
| Faults, multimeter, commissioning report | Built |
| Real-hardware performance, manual browsers, accessibility with assistive tech | **Not verified** |

## FAQ

- *My project disappeared.* Check Project library; if you cleared site data, restore from a backup file. Nothing is stored on a server.
- *Why can't I edit while it runs?* Editing is locked while the simulation runs so wiring and logic cannot change mid-scan: press Pause.
- *Why doesn't my timer work in ST?* Declare it in `VAR` (`tm : TON;`) and call it with named arguments each scan: `tm(IN := Go, PT := T#2s);`.
- *Is a result code proof of a score?* No: it is editable local data.

## Owner-only gates still open

Physical 8 GB / no-GPU Windows run; real Chrome/Edge/Firefox/Safari and tablet checks; assistive-technology pass; independent controls-engineer review; instructor and student trials; third-party license and asset clearance; the explicit owner GO and deployment decision.
