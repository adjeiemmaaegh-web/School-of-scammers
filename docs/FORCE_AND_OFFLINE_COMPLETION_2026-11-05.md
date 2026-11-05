# PLC Skills Lab — Input forcing and offline support contracts
Date: 5 November 2026

## Simulation-only PLC input forces
- The force table accepts Start, SensorOK, Photoeye and ExitSensor BOOL input-image tags only. Simulated power, guard, stop, feedback, PLC outputs, electrical wiring and physical motor starter are not forceable through this table.
- Virtual supply isolation and stopped motor are required before adding or clearing a force. Energized attempts are logged as rejected.
- Forces affect only the PLC sampled input image. The underlying plant/electrical sample is kept in rawPlcInputs and visible as a separate watch row. Active forced tags are explicitly flagged.
- Changes are actions in deterministic session replay, retained in the event log and included in replay fingerprints when forces are active. Unforced legacy sessions retain compatible fingerprints; fingerprints are not cryptographic authenticity proofs.
- Reset clears forces; an individual clear returns that tag to the original physical simulator sample.
- This implementation is deliberately not a live hardware force capability and is not a substitute for vendor-specific force, safety, or interlock practice.

## Production offline static shell
- Production build generates a versioned service worker which precaches the emitted HTML, lazy route assets and static files after a first online visit.
- Navigations are network-first with cached shell fallback; same-origin hashed static assets are cache-first. Cross-origin and non-GET network requests are untouched.
- A later online build installs a new cache and removes outdated generated shell caches. The worker is served without persistent HTTP caching.
- Session/project exports and browser storage are not copied to the offline shell. Offline first visit, storage denial/quota, private browsing, browser cache deletion, external resources or browser implementation differences may limit behavior.
- Chrome offline route acceptance must run alongside TypeScript, Vitest, Vite, accessibility, Firefox, Linux WebKit and no-WebGL CI checks.

**Neither feature establishes complete industrial fidelity, physical safety, cross-device acceptance or full release approval.**
