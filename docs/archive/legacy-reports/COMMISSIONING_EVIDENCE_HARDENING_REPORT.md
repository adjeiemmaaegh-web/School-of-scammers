# Commissioning evidence hardening

This single engineering increment fixes two assessment integrity weaknesses: repeated evidence capture from one unchanged PLC scan, and credit for conveyor products completed before the transfer stage. Every verified stage after the first now requires strictly later scan/time values, and transfer requires a newly completed product relative to the immediately preceding stage.

## Verification

Standalone strict TypeScript compilation of the modified commissioning module passed. Two Vitest regression tests were added but not executed; full Vite build and browser tests remain unverified. The test uses synthetic workcell snapshots to probe evidence invariants; real interactive commissioning still requires browser acceptance. No backend or remote services added.
