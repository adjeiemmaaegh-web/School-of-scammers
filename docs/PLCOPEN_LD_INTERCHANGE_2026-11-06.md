# Graphical Ladder PLCopen XML interchange — supported training subset
Date: 6 November 2026
Scope: Frontend-only IEC-oriented educational interchange; not a PLCopen compliance claim.

## Supported
- PLCopen TC6 XML v2.01 (http://www.plcopen.org/xml/tc6_0201), single PROGRAM POU, elementary BOOL input/output/local variables.
- Normally-open and normally-closed contacts, ordinary coils, series/parallel graph connections.
- Incoming graph links are OR junctions, sequential contacts are AND. The importer converts bounded paths into editable series/parallel elements.
- Bounded XML (max 150 KB), 200 coils, 64 expanded parallel paths per coil and graph depth 80.
- Explicit rejection of cycles, undeclared variables, duplicate coils, dangling edges, unsupported nodes and instruction semantics.
- Browser-based ladder editor import/export, with custom signal tags.

## Deliberately unsupported
- TON/TOF/TP/RTO, CTU/CTD, OSR/OSF, SET/RESET/inverted coils, function blocks, global variables, tasks, vendor extensions, multiple POUs or full visual diagram metadata.
- Native rung IDs, symbol descriptions, addresses, original coordinates or task metadata. Native project JSON is the lossless backup. XML export with symbols requires explicit acknowledgement of metadata loss.
- TC6 0200 namespace and full PLCopen/IEC 61131-10/IEC 61131-3 or vendor certification claims.

## Verification
- Scan equivalence across Boolean vectors for seal-in and compound parallel circuits.
- Independently authored external LD graph fixture and deliberately malformed/unsupported graph tests.
- Browser XML import/export and custom-tag authoring checks.
- TypeScript, Vitest, Vite and multi-browser CI checks before merging.

Reference: https://www.plcopen.org/standards/xml-echange/

Safety: Virtual education only. Do not use this XML pathway for live PLC equipment or industrial certification.
