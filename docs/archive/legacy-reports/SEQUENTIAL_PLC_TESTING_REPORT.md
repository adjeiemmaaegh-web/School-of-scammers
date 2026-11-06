# Sequential PLC testing increment — 2026-10-30

Added `src/engineering/ladder-sequences.ts` and a sequence test panel to `src/components/InstructionLab.tsx`. Users can enter bounded JSON scan vectors, preserve PLC memory across scans, compare expected outputs at each step, and export CSV evidence. Output forcing is rejected. Sequence engine limits: 100 steps, 1000 scans per step, 10000 total scans. Sample start/stop latch scenario included.

Verification: standalone engineering TypeScript check passed; 9/9 Node runtime assertions passed. Full Vite/React typecheck, browser rendering and Vitest remain unverified. This is a simulated educational test tool, not a safety-certified PLC.
