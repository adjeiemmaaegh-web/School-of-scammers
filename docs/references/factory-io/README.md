# FACTORY I/O user-supplied benchmark references

This directory is the entry point for the user-provided FACTORY I/O benchmark material used to design and evaluate **EFO Skill Lab / PLC Skills Lab**.

## Read first

[Complete consolidated reference review (9 November 2026)](FACTORY_IO_CONSOLIDATED_REFERENCE_2026-11-09.md)

The single consolidated document preserves:
- Primary article text extracted from six saved *Getting Started* HTML pages: navigating, opening a scene, creating a scene, manually controlling, and PLC control, plus their index.
- The 21-scene included-gallery catalogue, interface screenshots, 3D scene/parts-palette observations, Siemens driver selection and setup, and sampled I/O mapping.
- Scene placement, rotation, duplication/grouping, sensor positioning, forced tags, and Orbit/Fly/First Person navigation examples.
- Source filename inventory, SHA-256 checks, exact-duplicate upload notes, and what the uploaded screenshots/videos **do not** prove.

## Provenance and interpretation

The source collection is **34 unique user-supplied files**: 21 screenshots, six HTML pages and seven MP4 clips. This repository copy contains the complete *written consolidation*, **not the original binary screenshots or videos**. Original media must be obtained from the owner when exact pixel-level comparison or playback is required. The extracted article text is not the complete saved HTML website, and linked vendor assets were not supplied.

These references are design/interaction benchmarks, **not licensed source code, 3D assets, a Factory I/O executable, or test evidence for hardware PLC communication**. Do not copy third-party UI assets, meshes, documentation prose into the product, or assert achieved feature parity. Use independent implementations, and distinguish source-supported behavior from inference.

## For coding agents

Before proposing or changing application code, read `CLAUDE.md`, `docs/product/PRD.md`, `docs/product/ARCHITECTURE.md`, `docs/product/AUDIT_SIMULATOR_FIRST.md`, and `.claude/skills/automation-platform/SKILL.md`. Audit **main plus open PRs #28–#33**, which include overlapping, unmerged source work. Treat the simulator's authoritative Worker scan as the source of truth, preserve browser-local/frontend-only architecture, and run the repository's full automated gates. No deployment or merging of existing PRs is authorized by this reference commit.
