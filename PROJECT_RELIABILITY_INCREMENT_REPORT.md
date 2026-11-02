# PLC Skills Lab — Offline project reliability increment

Implemented: last-known-good recovery copy, explicit recovery workflow that preserves damaged primary bytes, cross-tab storage-change warning and write disable, and selected-project versus current-work semantic comparison. Five new Vitest regression definitions cover recovery paths. Existing engineering source preserved. No backend, cloud, authentication or database added.

Verification: isolated engineering-core TypeScript compile succeeded. Focused Node runtime checks are reported separately. Full React/Vite build and Vitest unavailable because node_modules is absent. Browser storage is not transactional across tabs; a race remains possible between a reload and save. Browser UI not tested. This is not production acceptance.
