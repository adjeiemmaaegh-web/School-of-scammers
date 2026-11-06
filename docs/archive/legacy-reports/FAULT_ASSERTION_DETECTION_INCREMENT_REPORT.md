# PLC Skills Lab — Fault observability versus assertion detection (2026-10-31)

## Engineering change
The fault matrix previously counted output divergence as `detected`, even when a learner had not authored any assertions to catch that divergence. This increment adds explicit checkpoint assertion evaluation for each injected fault, separate from scan-level output observability. It reports `assertionFailed`, `failedCheckpoints`, `assertionFailures`, and `observableButNotAsserted`; presents those in the Instruction Lab and exports assertion evidence to CSV. Existing `detected` remains an output-divergence compatibility field, not proof of monitoring detection.

## Checks
Engineering TypeScript compilation passed. Six native Node assertions passed against compiled modules. Four new Vitest definitions were added but not run. Full Vite/React build and browser/hardware checks remain unverified because dependencies are absent.

## Limits
Test assertions are evaluated at authored sequence checkpoints, not continuously. A passing assertion set cannot establish industrial safety, fault tolerance, or physical hardware equivalence. No backend, cloud, deployment, or GitHub changes.
