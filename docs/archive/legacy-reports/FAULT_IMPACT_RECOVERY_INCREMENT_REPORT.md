# Fault impact duration and recovery increment — 2026-10-31

Adds per-output contiguous difference windows from every simulated PLC scan, including when detailed evidence is capped. Reports how many output-divergent scans occur after the configured input fault ends, and whether all outputs converge by the end of the test. Exports impact windows as CSV and displays them in the Instruction Lab.

Engineering TypeScript isolated compilation passed. Five focused Node assertions passed. Full React/Vite, Vitest, browser, hardware tests remain unverified. Recovery means simulated output convergence at the final scan, not proof of safe physical recovery.
