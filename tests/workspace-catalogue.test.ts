import { describe, expect, it } from 'vitest';
import { componentKinds } from '../src/components/registry';
import { CATEGORIES, CATEGORY_BY_KIND, searchEquipment, catalogueCounts } from '../src/workspace/catalogue';
import { emptySelection, selectOne, toggleOne, selectAll, reconcileSelection } from '../src/workspace/selection';

describe('P1 source-backed device library', () => {
  it('assigns every real component to exactly one browsable category', () => {
    expect(Object.keys(CATEGORY_BY_KIND).sort()).toEqual([...componentKinds].sort());
    expect(CATEGORIES).toHaveLength(8);
    expect(Object.values(catalogueCounts()).reduce((a, b) => a + b, 0)).toBe(componentKinds.length);
  });
  it('searches by original label, description, category and multiple query tokens', () => {
    expect(searchEquipment('virtual plc')).toContain('plc16');
    expect(searchEquipment('24V', 'Power & protection')).toContain('supply');
    expect(searchEquipment('Motor', 'Sensors')).toEqual([]);
    expect(searchEquipment('reversing')).toEqual(searchEquipment('reversing'));
  });
});

describe('P1 selection semantics', () => {
  const parts = [{ id: 'a', kind: 'motor' as const, x: 10, y: 20, pressed: false },
    { id: 'b', kind: 'lamp' as const, x: 30, y: 40, pressed: false }];
  it('supports one, additive Ctrl-click, toggling off and select all', () => {
    expect(emptySelection()).toEqual([]);
    expect(selectOne('a')).toEqual(['a']);
    expect(toggleOne(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleOne(['a', 'b'], 'a')).toEqual(['b']);
    expect(selectAll(parts)).toEqual(['a', 'b']);
  });
  it('reconciles stale selections after a worker-reported remove/import', () => {
    expect(reconcileSelection(['missing', 'a', 'a', 'b'], parts)).toEqual(['a', 'b']);
  });
});
