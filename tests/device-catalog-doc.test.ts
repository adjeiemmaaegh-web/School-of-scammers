import { describe, expect, it } from 'vitest';
import committed from '../docs/product/DEVICE_CATALOG.md?raw';
import { deviceCatalogMarkdown } from '../src/components/catalog-doc';
import { COMPONENTS } from '../src/components/registry';

// No Node typings in the tests tsconfig (CI installs none): reach the environment through globalThis.
const nodeProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => { writeFileSync: (p: string, d: string) => void } } }).process;

describe('device catalogue document (R6.1 / R10.3)', () => {
  it('is regenerated from the registries and is not stale', () => {
    const fresh = deviceCatalogMarkdown();
    if (nodeProcess?.env?.UPDATE_DEVICE_CATALOG) {
      const fs = nodeProcess.getBuiltinModule!('node:fs');
      fs.writeFileSync('docs/product/DEVICE_CATALOG.md', fresh);
      return;
    }
    expect(committed, 'docs/product/DEVICE_CATALOG.md is stale: run UPDATE_DEVICE_CATALOG=1 npx vitest run tests/device-catalog-doc.test.ts').toBe(fresh);
  });
  it('lists every registered kind exactly once', () => {
    for (const kind of Object.keys(COMPONENTS)) expect(committed.split(`| \`${kind}\` |`).length - 1, kind).toBe(1);
  });
});
