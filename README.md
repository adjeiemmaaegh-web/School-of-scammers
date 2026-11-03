# PLC Skills Lab

Offline-first browser-based 3D PLC training and hiring platform.

## Development

Requires Node.js 22 and npm with registry access.

```sh
npm install
npm run dev
```

## Verification

```sh
npm run verify:engineering:offline
npm run verify:full
```

`verify:full` checks TypeScript, runs Vitest and attempts the Vite production build. GitHub Actions runs these checks on push and pull request. The `main` workflow passed on 3 November 2026, including TypeScript, 435 Vitest tests, Vite, headless Chrome, Firefox, Linux WebKit, accessibility and no-WebGL checks ([run 41629057801](https://github.com/adjeiemmaaegh-web/School-of-scammers/actions/runs/41629057801)). This does not establish certified safety, full IEC or WCAG conformance, real Safari-device support or 8 GB Windows performance. This project is an educational simulator, not certified industrial control or safety equipment.

The previous repository README identified this as a 3D PLC training and hiring platform.
