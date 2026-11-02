# PLC Skills Lab — Replay Checkpoint Integrity Increment (2026-10-31)

## Change
Portable workcell sessions now include a bounded, deterministic checkpoint ledger at every 50 simulated scans and at the final scan. Session import replays the original ladder program and wiring and validates each checkpoint in chronological order, reporting the earliest mismatching checkpoint instead of relying solely on the final-state fingerprint. Existing sessions without checkpoints remain readable with final-state verification. The noncryptographic fingerprints detect accidental divergence, not malicious alteration, authenticity, or real-machine safety. The 2,000-action cap remains.

## Verification limits
Engineering TypeScript compilation and offline integration contracts are checked locally. Full Vite build, Vitest execution, browser interaction and real hardware acceptance remain unverified without frontend dependencies. No backend, cloud, GitHub or deployment changes.
