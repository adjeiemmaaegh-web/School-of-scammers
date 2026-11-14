# Factory simulation slices (P6–P25) — index

The 3D workcell builder, the equipment/scene library and the worker-verified factory scenarios were developed as a long chain of slices. Each slice kept its own evidence record; they are archived in [`archive/factory-slices/`](archive/factory-slices/) so this folder stays readable. This page is the only entry point; the records are history, not current status.

**Current status lives in** `RELEASE_READINESS_2026-11-15.md` (gates), `SANDBOX_BREADTH_PROGRESS.md` (sandbox devices, multi-PLC, settings, faults), `P3_PLANT_PROGRESS.md` and `P2_PROGRAMMING_PROGRESS.md`.

**How to read the evidence.** Each slice's tests run the learner's real PLC program through the real `tick()` against the simulated plant; none are canned animations. Every one is an educational simplification, not physical accuracy, not safety-rated, and not independently validated by a controls engineer. Passing automated tests on a branch proves only that those tests passed.

| Record | Title |
|---|---|
| [INTEGRATION_REVIEW.md](archive/factory-slices/INTEGRATION_REVIEW.md) | PLC Skills Lab — engineering integration review |
| [P10_WORKER_COMMISSIONING.md](archive/factory-slices/P10_WORKER_COMMISSIONING.md) | P10 — Worker-Grounded Scene Commissioning |
| [P11_CHRONOLOGICAL_FACTORY_ASSESSMENT.md](archive/factory-slices/P11_CHRONOLOGICAL_FACTORY_ASSESSMENT.md) | PLC Skills Lab P11 — Chronological Worker-Verified Factory Trials |
| [P12_MULTICASE_FACTORY_VALIDATION.md](archive/factory-slices/P12_MULTICASE_FACTORY_VALIDATION.md) | P12 — Multi-Case Factory PLC Validation (Development Record) |
| [P13_FACTORY_MATRIX_EXPANSION.md](archive/factory-slices/P13_FACTORY_MATRIX_EXPANSION.md) | P13 — Factory Matrix Expansion & Physics Integrity |
| [P14_REAL_PHYSICAL_PRODUCTS.md](archive/factory-slices/P14_REAL_PHYSICAL_PRODUCTS.md) | PLC Skills Lab P14 — Real Physical Product Transfer and Processing |
| [P15_AUTONOMOUS_FACTORY_PROCESS_COMPLETION.md](archive/factory-slices/P15_AUTONOMOUS_FACTORY_PROCESS_COMPLETION.md) | PLC Skills Lab — P15 Autonomous Factory Process Completion |
| [P15_REPEATED_PRODUCT_TRIALS.md](archive/factory-slices/P15_REPEATED_PRODUCT_TRIALS.md) | PLC Skills Lab — P15 Repeated Physical Product Trials (Draft) |
| [P16_FAULT_RESILIENCE_ENGINEERING.md](archive/factory-slices/P16_FAULT_RESILIENCE_ENGINEERING.md) | PLC Skills Lab — P16 Fault Resilience, Deterministic Replay and Assessment Integrity |
| [P17_SEEDED_MATERIAL_QUALITY.md](archive/factory-slices/P17_SEEDED_MATERIAL_QUALITY.md) | PLC Skills Lab — P17 Seeded Material Lots and Physical Quality Campaign |
| [P18_CONVEYOR_JAM_RECOVERY.md](archive/factory-slices/P18_CONVEYOR_JAM_RECOVERY.md) | PLC Skills Lab — P18 Conveyor Jam, Maintenance Reset and Same-Body Recovery |
| [P19_POWER_LOSS_RESTART_RECOVERY.md](archive/factory-slices/P19_POWER_LOSS_RESTART_RECOVERY.md) | PLC Skills Lab — P19 Controlled Restart After 24 V PLC and Conveyor Drive Outages |
| [P20_PHYSICAL_OBSTRUCTION_TRIP.md](archive/factory-slices/P20_PHYSICAL_OBSTRUCTION_TRIP.md) | PLC Skills Lab — P20 Physically Triggered Gate Obstruction and Original-Carton PLC Recovery |
| [P21_BODY_QUEUE_DWELL.md](archive/factory-slices/P21_BODY_QUEUE_DWELL.md) | PLC Skills Lab — P21 Sustained Original Carton Queue and Physically Cleared Conveyor Trip |
| [P22_PHYSICAL_ZONE_FEED_INHIBIT.md](archive/factory-slices/P22_PHYSICAL_ZONE_FEED_INHIBIT.md) | PLC Skills Lab P22 — Original Physical Zone Occupancy and PLC Feeder Backpressure Control |
| [P23_TWO_BELT_HANDOFF_AND_BACKPRESSURE.md](archive/factory-slices/P23_TWO_BELT_HANDOFF_AND_BACKPRESSURE.md) | PLC Skills Lab P23 — Original Two-Belt Handoff and Real PLC Downstream Backpressure |
| [P24_PHYSICAL_DOWNSTREAM_HOLD_RELEASE.md](archive/factory-slices/P24_PHYSICAL_DOWNSTREAM_HOLD_RELEASE.md) | PLC Skills Lab P24 — Original Physical Downstream Hold and Powered Release |
| [P25_STUCK_OUTFEED_ALARM_RETRY.md](archive/factory-slices/P25_STUCK_OUTFEED_ALARM_RETRY.md) | PLC Skills Lab P25 — Genuine Stuck Outfeed, Fault-Latched Lamp and Fresh Maintenance Retry |
| [P6_VISUAL_WORKCELL_BUILDER.md](archive/factory-slices/P6_VISUAL_WORKCELL_BUILDER.md) | 3D Industrial Workcell Builder — P6 source development |
| [P7_ADVANCED_3D_FACTORY_EDITOR.md](archive/factory-slices/P7_ADVANCED_3D_FACTORY_EDITOR.md) | P7 Advanced 3D Factory Editor — engineering evidence and acceptance |
| [P8_INDUSTRIAL_SIMULATION_REALISM.md](archive/factory-slices/P8_INDUSTRIAL_SIMULATION_REALISM.md) | PLC Skills Lab — P8 Industrial Simulation Realism |
| [P9_ORIGINAL_FACTORY_SCENES.md](archive/factory-slices/P9_ORIGINAL_FACTORY_SCENES.md) | P9 — Original 21-Scene Industrial Learning Library |
