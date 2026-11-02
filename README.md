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

`verify:full` checks TypeScript, runs Vitest and attempts the Vite production build. The complete build has **not yet passed** in the source environment because dependencies could not be installed there. GitHub Actions runs these checks on push and pull request. This project is an educational simulator, not certified industrial control or safety equipment.

The previous repository README identified this as a 3D PLC training and hiring platform.
