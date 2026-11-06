# PLC Skills Lab — Scan instrumentation and diagnostic tracing

## Scope
One consolidated source increment adds a scan-synchronized virtual logic analyzer and trace recorder to the existing engineering workbench. It records actual deterministic workcell state, with 12 measured digital/analog signals, digital edge detection, statistics, CSV export, trace selection, and a scan-history display. Recording is bounded to 500 samples; trace rendering uses the latest 150 samples. Reset clears the recorder. This is not a physical oscilloscope and does not sample sub-scan transients.

## Verification
The engineering-core TypeScript compiler check was run. A standalone Node runtime smoke check is performed separately; Vitest tests are included but require the unavailable application dependencies. Full React/Vite build, browser rendering, cross-browser and real-hardware validation remain pending.

## Safety and scope
Educational simulation only. No backend, authentication, database, SaaS or employer management. No GitHub changes. Signals are read from the existing PLC workcell; the visualization does not drive the simulation.
