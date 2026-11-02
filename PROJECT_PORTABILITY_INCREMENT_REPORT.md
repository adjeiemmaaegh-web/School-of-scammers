# PLC Skills Lab — Offline project portability

Implemented a versioned JSON project format for ladder program, wiring board, board mode and project name. Import validates file size, ladder syntax, IO mapping, component identity, terminal references, duplicates and supply count before replacing the editor state. Import resets the simulator, recorder, scan history and commissioning evidence. The file intentionally excludes live state and assessment records.

Verification: isolated TypeScript compilation passed; 5 direct Node checks passed (roundtrip and four invalid input rejections). Full Vite/React build and browser import/export were not run. Educational model only. No backend.
