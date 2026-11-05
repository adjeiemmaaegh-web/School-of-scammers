# Third-party dependency license evidence — 6 November 2026

**Source:** GitHub Actions Linux CI run 41981809981, artifact 13394003486 (plc-release-provenance), CycloneDX 1.5 dependency inventory. This is a *snapshot of installed dependencies*, not a complete repository-wide software licensing opinion.

## Exact evidence observed
- 168 installed components included in the captured SBOM; 217 package graph entries exist in the generated Node 22 npm lockfile (includes optional/resolution graph entries not necessarily installed or represented in the SBOM).
- SBOM license declarations: 146 MIT, 9 Apache-2.0, 8 ISC, 3 BSD-3-Clause, 1 CC-BY-4.0 and 1 missing/unspecified.
- The CC-BY-4.0 data package is caniuse-lite 1.0.30001820. Its upstream README requests attribution to caniuse.com, and credits the dataset under CC-BY-4.0: https://github.com/browserslist/caniuse-lite
- The package without a declared license in the captured SBOM is webgl-constants 1.1.1. Its npm README says the author's work is MIT licensed, while the npm metadata sidebar currently reports no license identifier: https://www.npmjs.com/package/webgl-constants. Inspect the exact published tarball and its notice to resolve this discrepancy; do **not** infer legal clearance solely from the README.
- The same artifact's npm audit JSON reported zero known vulnerabilities for the installed graph at snapshot time. Audit findings change and are not a guarantee.
- Generated source-assets.json listed an empty scanned external asset inventory; this does not prove there are no manually embedded or later added third-party assets.

## Preliminary attribution notice (requires approval)
The build/development dependency graph includes caniuse-lite data (version from the cited SBOM snapshot) sourced from caniuse.com, subject to Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/. No code or data modification is asserted by this inventory; re-check whether and how it is redistributed in each final build.

## Before full commercial release
- Perform legal review of all direct/transitive package terms, their applicable distribution contexts, copyright notices and asset/texture/font provenance.
- Resolve webgl-constants 1.1.1's manifest-versus-README discrepancy against the precise tarball.
- Generate current SBOM/audit for the final pinned lockfile and preserve signed signoffs.
- Review site privacy, security, browser storage and frontend integrity controls.
- Retain full formal industrial accuracy and user-device acceptance gates.

**Decision:** Useful provenance evidence collected; formal legal redistribution clearance remains **NOT APPROVED**.
