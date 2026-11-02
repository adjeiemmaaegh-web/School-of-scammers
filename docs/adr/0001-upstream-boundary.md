# ADR-0001 — Open Industry Project adoption boundary

Decision: **selective reuse candidate, not an unconditional fork**. No upstream source has been copied or modified in this increment.

The current browser-first upstream is https://github.com/Open-Industry-Project/Open-Industry-Project (NOT the archived Godot predecessor). Its public documentation reports MIT licensing, TypeScript, Three.js, Jolt physics, a built-in PLC subset, PLCopen XML import/export, and a custom part SDK. Its repository also includes collaboration, server, desktop, vendor and asset code. We must not import those unrelated services into the backend-excluded lab.

Before copying code: obtain the exact upstream Git commit and source archive; inspect `LICENSE`, `THIRD_PARTY_NOTICES.md`, package lock, asset provenance and per-folder licensing; inventory transitive GPL/AGPL and noncommercial constraints; identify modules with DOM/worker/native coupling; preserve attribution and notices; run a representative browser-only build. An MIT top-level license does **not** clear every asset or dependency.

Adoption gates: (1) browser-only and no backend requirements; (2) deterministic headless PLC and plant contracts; (3) legal asset and dependency review; (4) stable adapter layer and pinned commit; (5) acceptable bundle and low-end hardware profile. Until those gates pass, build our own small headless reference PLC kernel and keep upstream integration behind interfaces. No claim of IEC certification or hardware equivalence.

Evidence limitation: upstream metadata and documentation were reviewed publicly, but direct Git clone failed because GitHub DNS was unavailable in the build container. No source-level license or architecture audit is claimed.
