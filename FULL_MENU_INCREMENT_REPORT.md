# PLC Skills Lab — Complete navigation and learning portal increment

## Scope
One consolidated menu implementation replaces the previous prototype's minimal navigation. The entire browser menu is built in this increment, rather than delivered as a series of menu fragments.

## Sections
- Overview dashboard: real available-exercise counts, recent practice, favorites and workspaces.
- Laboratory catalogue: text search, discipline, level, availability and saved filters; available/planned status is explicit.
- Learning pathway: sequenced links to implemented exercises.
- Workspaces: direct entry to PLC programming, wiring, 3D simulation and fault assessment.
- PLC & wiring studio: preserves the existing engineering workbench.
- Fault assessment: preserves the existing scenario and scoring workflow.
- Knowledge base: expandable quick engineering references.
- Local settings: progress JSON export and confirmable local checklist reset.
- About: scope, limitations and separation from backend team.
- Responsive persistent sidebar, active section indicator, mobile menu and 404 fallback.

## Product boundaries
Removed the employer workspace navigation and its frontend page; backend, employer accounts, authentication and cloud data remain outside scope. Saved and practiced markers are local-only convenience metadata, not assessment results or certification. Planned labs are visibly disabled. Existing engineering runtime and simulator are preserved without unverified changes.

## Verification
Added four regression test cases for catalogue integrity, coverage, navigation and local progress. Package ZIP CRC integrity is checked. Dependency installation timed out, so the complete application build, Vitest execution and real-browser verification are NOT claimed. This increment does not establish production readiness.
