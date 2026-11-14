import {describe,expect,it} from 'vitest';
import {COMPONENTS,componentKinds} from '../src/components/registry';
import {DEVICE_FAMILIES,familyForKind,matchesFamily,supportedFamilies} from
  '../src/ui/sandbox/workspace-catalog';

describe('P5-UX actual supported device catalog',()=>{
  it('organizes all registered devices exactly once without creating unsupported kinds',()=>{
    expect(componentKinds.length).toBeGreaterThan(15);
    const ids=DEVICE_FAMILIES.map(x=>x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for(const kind of componentKinds){
      expect(COMPONENTS[kind]).toBeDefined();
      const family=familyForKind(kind);
      expect(ids).toContain(family);
      expect(matchesFamily(kind,family)).toBe(true);
      expect(DEVICE_FAMILIES.filter(f=>f.id!=='all'&&matchesFamily(kind,f.id))).toHaveLength(1);
    }
  });
  it('filters categories deterministically and keeps an all-devices fallback',()=>{
    expect(supportedFamilies(['plc','motor','photoeye'])).toEqual(
      ['all','plc','sensors','drives']);
    expect(supportedFamilies([])).toEqual(['all']);
    expect(matchesFamily('motor','all')).toBe(true);
    expect(matchesFamily('motor','plc')).toBe(false);
    expect(matchesFamily('unregistered-future-device','electrical')).toBe(true);
  });
  it('shows both process and motion equipment where implemented',()=>{
    expect(familyForKind('tank')).toBe('process');
    expect(familyForKind('cylinder')).toBe('motion');
    expect(familyForKind('conveyor')).toBe('handling');
    expect(familyForKind('plc16')).toBe('plc');
    expect(familyForKind('revmotor')).toBe('drives');
  });
});
