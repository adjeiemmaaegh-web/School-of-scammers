import { describe, expect, it } from 'vitest';
import { instructionBreakpointHit, validateInstructionBreakpoint } from '../src/program/instruction-breakpoint';
import { createWorld, tick } from '../src/sim/orchestrator';
import { fbdMotorStarter } from '../src/engineering/fbd';

describe('P2 instruction-level scan breakpoints',()=>{
  it('detects Boolean edges and exact simulated timer/counter thresholds',()=>{
    const before=[{id:'rung-1',on:false},{id:'timer',on:false,elapsedMs:50,count:0}];
    const after=[{id:'rung-1',on:true},{id:'timer',on:true,elapsedMs:100,count:1}];
    expect(instructionBreakpointHit({id:'rung-1',metric:'edge',edge:'rising'},before,after,2)).toContain('rung-1');
    expect(instructionBreakpointHit({id:'timer',metric:'elapsedMs',threshold:100},before,after,2)).toContain('100');
    expect(instructionBreakpointHit({id:'timer',metric:'count',threshold:2},before,after,2)).toBeNull();
    expect(instructionBreakpointHit({id:'rung-1',metric:'edge',edge:'falling'},before,after,2)).toBeNull();
    expect(validateInstructionBreakpoint({id:'rung-1',metric:'edge',edge:'rising'},['rung-1'])).toBe(true);
    expect(validateInstructionBreakpoint({id:'rung-1',metric:'count',threshold:-1},['rung-1'])).toBe(false);
  });
  it('breaks after the first real Ladder rung transitions from off to on',()=>{
    let w=tick(createWorld(),[{k:'addPanel',template:'motor-starter'}]).world;
    w=tick(w,[{k:'breakOnInstruction',breakpoint:{id:'rung-1',metric:'edge',edge:'rising'}}]).world;
    expect(w.lastError).toBeNull();
    w=tick(w,[{k:'run'},{k:'operate',id:'start-1',pressed:true}]).world;
    expect(w.breakpointHit).toContain('rung-1');
    expect(w.running).toBe(false);
    expect(w.coils.Run).toBe(true);
  });
  it('uses FBD block results from the same authoritative scan and preserves PLC outputs',()=>{
    let w=tick(createWorld(),[{k:'addPanel',template:'motor-starter'}]).world;
    w=tick(w,[{k:'loadFBD',document:fbdMotorStarter()}]).world;
    w=tick(w,[{k:'breakOnInstruction',breakpoint:{id:'coil',metric:'edge',edge:'rising'}}]).world;
    expect(w.lastError).toBeNull();
    w=tick(w,[{k:'run'},{k:'operate',id:'start-1',pressed:true}]).world;
    expect(w.breakpointHit).toMatch(/coil.*rising/);
    expect(w.coils.Run).toBe(true);
    expect(w.fbdSteps.find(n=>n.nodeId==='coil')?.on).toBe(true);
  });
  it('fails validation for unknown block/rung IDs or malformed thresholds',()=>{
    const w=tick(createWorld(),[{k:'breakOnInstruction',breakpoint:{id:'missing',metric:'edge',edge:'rising'}}]).world;
    expect(w.lastError).toMatch(/Instruction breakpoint/);
    expect(w.breakpointInstruction).toBeNull();
  });
});
