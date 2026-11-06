# PLC Skills Lab — Regression suite optimization

Adds a bounded greedy set-cover optimizer to the existing whole-suite mutation campaign. It suggests a smaller subset of independently reviewed regression cases that preserves all *observed* mutant detections from a complete campaign. Supports CSV review and explicitly gated application in the Instruction Lab. A truncated campaign cannot be optimized. Applying a suggestion clears stale reports and requires rerunning assertions and mutation analysis. Does not guarantee preservation of requirements or globally minimal test size.

Verification: isolated engineering TypeScript compilation and focused native Node assertions; full application build, Vitest, browser and hardware testing not executed in this environment.
