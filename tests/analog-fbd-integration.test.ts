/** Real numeric FBD input must never treat an unplugged process sensor as
 * a valid 0-unit reading and energize a connected 24V actuator. */
import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command } from '../src/sim/signals';
import type { FbdDocument } from '../src/engineering/fbd';

const commands:Command[]=[
  {k:'place',id:'supply',kind:'supply',at:{x:10,y:10}},
  {k:'place',id:'ctrl',kind:'plc16',at:{x:280,y:10}},
  {k:'place',id:'tank',kind:'tank',at:{x:800,y:400}},
  {k:'place',id:'pump',kind:'pump',at:{x:850,y:450}},
  {k:'wire',id:'power-plc',from:'supply.P24',to:'ctrl.L+'},
  {k:'wire',id:'common-plc',from:'supply.M0',to:'ctrl.M'},
  {k:'wire',id:'pump-drive',from:'ctrl.Q0.0',to:'pump.L+'},
  {k:'wire',id:'pump-return',from:'supply.M0',to:'pump.M-'},
  {k:'wire',id:'analog',from:'tank.LEVEL',to:'ctrl.AI0'},
];
const diagram:FbdDocument={id:'tank-fbd',version:'1.0',nodes:[
  {id:'below',kind:'compare',tag:'Analog0',comparator:'lt',threshold:250},
  {id:'command',kind:'output',tag:'Out0',inputs:['below']},
]};
const setup=()=> {
  const w=tick(createWorld(),[...commands,{k:'loadFBD',document:diagram}]).world;
  expect(w.lastError).toBeNull();
  expect(w.project.language).toBe('fbd');
  return w;
};

describe('FBD numeric input through genuine tank-to-PLC16 worker wiring',()=>{
  it('drives wired pump below 250 ml and stops above threshold',()=>{
    let w=tick(setup(),[{k:'run'}]).world;
    expect(w.lastError).toBeNull();
    expect(w.plcs.ctrl.coils.Out0).toBe(true);
    for(let i=0;i<90;i++)w=tick(w).world;
    expect(w.lastError).toBeNull();
    expect(w.vessels.tank.levelMl).toBeGreaterThanOrEqual(250);
    expect(w.plcs.ctrl.coils.Out0).toBe(false);
    expect(w.deviceOn.pump).toBe(false);
    expect(renderSnapshot(w).plcs.ctrl.io.analogInputs?.[0]).toMatchObject({
      tag:'Analog0',unit:'ml',connected:true,source:'tank.LEVEL',
    });
  });

  it('refuses to run when the comparator source is unplugged',()=>{
    let w=tick(setup(),[{k:'unwire',id:'analog'}]).world;
    expect(w.lastError).toBeNull();
    w=tick(w,[{k:'run'}]).world;
    expect(w.running).toBe(false);
    expect(w.lastError).toMatch(/Numeric input Analog0 has no connected source/);
    expect(w.deviceOn.pump).toBeUndefined();
  });

  it('fails closed after a numeric wire-open fault while the FBD output is active',()=>{
    let w=tick(setup(),[{k:'run'}]).world;
    expect(w.plcs.ctrl.coils.Out0).toBe(true);
    w=tick(w,[{k:'injectFault',kind:'wire-open',target:'analog',hidden:false}]).world;
    expect(w.running).toBe(false);
    expect(w.lastError).toMatch(/Numeric input Analog0 has no connected source/);
    expect(w.deviceOn.pump).toBeUndefined();
  });
});
