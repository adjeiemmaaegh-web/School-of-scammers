import {describe,it,expect} from 'vitest';
import {nodeHeightOf,portsOf,endpointOf,logicalWirePaths} from '../src/ui/sandbox/logical-wiring';
import type {PlacedComponent,Wire} from '../src/sim/signals';
const parts:PlacedComponent[]=[
 {id:'supply',kind:'supply',x:20,y:30,pressed:false},
 {id:'plc',kind:'plc',x:300,y:40,pressed:false},
 {id:'controller',kind:'plc16',x:540,y:80,pressed:false},
];
describe('P5-UX real terminal logical view geometry',()=>{
  it('anchors each drawn terminal to the correct project ID and side',()=>{
    const supply=portsOf(parts[0]);
    expect(supply.some(p=>p.name==='P24')).toBe(true);
    const p=endpointOf('supply.P24',parts);
    expect(p).not.toBeNull();
    expect(p?.x===parts[0].x||p?.x===parts[0].x+170).toBe(true);
    expect(endpointOf('missing.P24',parts)).toBeNull();
    expect(endpointOf('supply.unknown',parts)).toBeNull();
  });
  it('avoids overlapping PLC16 port labels and expands tall controllers',()=>{
    const ports=portsOf(parts[2]);
    for(const side of ['left','right'] as const){
      const sidePorts=ports.filter(p=>p.side===side).map(p=>p.y);
      for(let i=1;i<sidePorts.length;i++)expect(sidePorts[i]-sidePorts[i-1]).toBeGreaterThanOrEqual(20);
    }
    expect(nodeHeightOf(parts[2])).toBeGreaterThan(130);
  });
  it('renders only validated endpoint pairs without inventing electrical state',()=>{
    const wires:Wire[]=[
      {id:'w1',from:'supply.P24',to:'plc.L+'},
      {id:'bad',from:'missing.P24',to:'plc.L+'},
    ];
    const routes=logicalWirePaths(parts,wires);
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe('w1');
    expect(routes[0].path).toMatch(/^M \d+ \d+ L/);
    expect(routes[0].path).not.toMatch(/undefined|NaN/);
    expect(logicalWirePaths(parts,[])).toEqual([]);
  });
});
