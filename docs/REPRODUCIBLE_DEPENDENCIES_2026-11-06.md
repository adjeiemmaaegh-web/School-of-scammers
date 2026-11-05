# Reproducible dependency resolution — 6 November 2026
Scope: PLC Skills Lab frontend-only; locked npm resolution, not a security or legal approval.

- package-lock.json v3 generated on the project's GitHub-hosted Ubuntu Node 22 runner using npm install --package-lock-only --ignore-scripts.
- Root packages/dependencies verified against package.json; full tree verified with npm ci --ignore-scripts (no third-party lifecycle script execution in generation).
- 217 root plus transitive package records represented in committed lock file.
- Both standard Linux GitHub CI and native Windows/Edge GitHub CI switched to npm ci, which fails on missing/outdated package lock entries instead of silently updating them.
- Temporary feature-branch-only workflow with contents:write deleted after it generated the lock file. This permission is not retained in main.
- CI continues to emit CycloneDX SBOM, npm audit JSON and source-asset inventory as evidence.
- Historical baseline (5 November 2026) npm audit output reported zero vulnerabilities; current and future builds must be checked separately. No guarantee of vulnerability-free code or future package safety.

Remaining obligations: legal review of all licensing/source provenance, asset/texture/model credits, browser storage and CSP/security review, vendor/hardware model validation and instructor/device acceptance. Release remains NO-GO for industrial/commercial claims.
