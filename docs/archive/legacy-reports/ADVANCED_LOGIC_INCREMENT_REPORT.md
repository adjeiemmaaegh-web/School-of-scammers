# PLC Skills Lab — Advanced PLC Instruction and Conveyor Exercise Increment

Date: 2026-10-30. Baseline: `PLC_Skills_Lab_Project_Reliability_2026-10-30.zip` (source retained; no GitHub push or external deployment).

## Implemented

- Extended deterministic PLC ladder runtime with RTO (retentive on-delay), CTU optional independent reset input, and OSR/OSF rising/falling edge one-scan pulses. Retentive timer reset takes priority over simultaneous enable; counter reset does not create a phantom increment while counting contact remains high.
- Extended ladder editor with all six instruction families, reset input selector, preset entry, and relevant user/plant tag options. Ordinary TON/TOF/CTU programs remain supported.
- Added isolated instruction bench for current user ladder or six ready-to-run exercises: TON, TOF, RTO, CTU, edge pulses, and interlocked conveyor batch counter. Manual Boolean input controls, 1/10/50-scan stepping, live coil and accumulator state, last-rung power flow, recent trace and bounded CSV export. No virtual workcell input is overridden by a logic-lab toggle.
- Connected actual workcell photoeye, exit sensor, starter feedback, and motor feedback into the PLC's beginning-of-scan input snapshot, allowing photoeye-triggered counters. Added simulated counter and timer reset pushbuttons. Workcell motor starter's physical power/guard interlocks remain authoritative, regardless of ladder output.
- Added one integrated motor+product+photoeye counting test that actually starts the conveyor and transports three packages to the photoeye, rather than substituting synthetic pulses for the process model.
- Corrected inaccurate legacy workcell regression setup: an isolated sensor requires its signal terminal wired to I0.2 in addition to the sensor cable connection. Previously two positive-start tests assumed the disconnected PLC terminal was wired.
- Updated README with usage and explicit limitations.

## Verification performed

- `tsc --strict --noEmit --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --skipLibCheck src/engineering/*.ts` — **PASSED**.
- Narrow UI semantic check of `InstructionLab.tsx` and `LadderEditor.tsx` with temporary React type stubs (not genuine React dependencies) — **PASSED**. This is not a substitute for the full application typecheck.
- Ten focused TypeScript test modules compiled to CommonJS despite missing Vitest declarations and executed in Node using a temporary `node:assert/strict`-based compatibility harness — **66/66 tests passed**, including 19 newly added tests. **Important:** This was *not* a real Vitest run and does not validate Vitest runner, application browser rendering, or source-map integration.
- Attempts to install dependencies through offline npm and network npm did not succeed. Consequently `npm run build`, real Vitest, full TSX typecheck, browser, GPU/3D, and real PLC/hardware acceptance were NOT run. Production release remains **NO-GO / unverified**.

## Key files changed

- `src/engineering/ladder.ts`
- `src/engineering/instruction-lab.ts` (new)
- `src/engineering/workcell.ts`
- `src/components/InstructionLab.tsx` (new)
- `src/components/LadderEditor.tsx`
- `src/components/EngineeringWorkbench.tsx`
- `tests/instruction-lab.test.ts` (new)
- `tests/workcell.test.ts`
- `README.md`

No backend, database, auth, payments, SaaS integration, GitHub push, or deployment introduced.
