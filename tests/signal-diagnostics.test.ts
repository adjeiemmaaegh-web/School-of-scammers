import {describe,it,expect} from 'vitest';
import {evaluateDiagnostics,DEFAULT_RULES,diagnosticsCsv} from '../src/engineering/signal-diagnostics';
import type {Recorder,ScanSample} from '../src/engineering/scan-instruments';
const sample=(scan:number,motor:number,belt:number):ScanSample=>({scan,timeMs:scan*100,values:{power:24,motor,belt,sensor:1,run:0,photoeye:0,exit:0,diverter:0,products:0,completed:0,rejected:0,contactor:0}});
const rec=(...samples:ScanSample[]):Recorder=>({capacity:500,samples});
describe('scan diagnostics',()=>{
 it('requires dwell threshold',()=>expect(evaluateDiagnostics(rec(sample(1,1,0),sample(2,1,0))).alarms.some(a=>a.ruleId==='motor-belt')).toBe(false));
 it('detects sustained mismatch',()=>expect(evaluateDiagnostics(rec(sample(1,1,0),sample(2,1,0),sample(3,1,0))).alarms.some(a=>a.ruleId==='motor-belt'&&a.active)).toBe(true));
 it('closes alarms after recovery',()=>expect(evaluateDiagnostics(rec(sample(1,1,0),sample(2,1,0),sample(3,1,0),sample(4,0,0))).alarms.find(a=>a.ruleId==='motor-belt')?.active).toBe(false));
 it('rejects duplicate rules',()=>expect(()=>evaluateDiagnostics(rec(),[DEFAULT_RULES[0],DEFAULT_RULES[0]])).toThrow());
 it('rejects nonmonotonic samples',()=>expect(()=>evaluateDiagnostics(rec(sample(2,1,0),sample(1,1,0)))).toThrow());
 it('exports CSV',()=>expect(diagnosticsCsv(evaluateDiagnostics(rec(sample(1,1,0),sample(2,1,0),sample(3,1,0))))).toContain('motor-belt,critical'));
});
