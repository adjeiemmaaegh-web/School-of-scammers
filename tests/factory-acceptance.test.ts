import {describe,it,expect} from 'vitest';
import {FAT_DEFINITIONS,runFactoryAcceptance,fatChecksCsv,fatEvidenceCsv} from '../src/engineering/factory-acceptance';
import {workcellLadder} from '../src/engineering/workcell';
import {changeBoard,newBoard} from '../src/engineering/wiring-board';
import type {LadderDocument} from '../src/engineering/ladder';

const unwired=newBoard();
const wired=changeBoard(changeBoard(newBoard(),{kind:'connect',from:'PS.P',to:'I0.IN'},false),{kind:'connect',from:'PS.M',to:'I0.COM'},false);
const run=(id:typeof FAT_DEFINITIONS[number]['id'])=>runFactoryAcceptance(workcellLadder,'fixture',undefined,[id]).cases[0];

describe('simulated factory acceptance',()=>{
 it('runs ten independent scenarios',()=>{const r=runFactoryAcceptance();expect(r.total).toBe(10);expect(r.passed).toBe(10);expect(r.failed).toBe(0);expect(r.cases.map(c=>c.id)).toEqual(FAT_DEFINITIONS.map(c=>c.id));});
 it('is deterministic over repeated runs',()=>{expect(runFactoryAcceptance()).toEqual(runFactoryAcceptance());});
 it('simulates at most the bounded scan budget for each case',()=>{const r=runFactoryAcceptance();expect(r.cases.every(c=>c.scans<=1000&&c.evidence.length<=50)).toBe(true);});
 it('records monotonic scans and time from real simulated steps',()=>{const r=runFactoryAcceptance();expect(r.cases.every(c=>c.evidence.every((e,i)=>i===0||(e.scan>c.evidence[i-1].scan&&e.timeMs>c.evidence[i-1].timeMs)))).toBe(true);});
 it('isolates the test sandbox from source program and board',()=>{const program=JSON.stringify(workcellLadder),board=JSON.stringify(wired);runFactoryAcceptance(workcellLadder,'configured-board',wired,['start-permissives']);expect(JSON.stringify(workcellLadder)).toBe(program);expect(JSON.stringify(wired)).toBe(board);});
 it('starts with an explicit run permit',()=>{const r=run('start-permissives');expect(r.passed).toBe(true);expect(r.checks.some(c=>c.name==='No motor movement before START'&&c.passed)).toBe(true);});
 it('clears run latch on stop and does not restart automatically',()=>{expect(run('stop-command').passed).toBe(true);});
 it('checks physical guard and PLC latch independently',()=>{expect(run('guard-restart').passed).toBe(true);});
 it('checks power restoration with new start action',()=>{expect(run('power-cycle').passed).toBe(true);});
 it('detects open sensor input',()=>{expect(run('sensor-loss').passed).toBe(true);});
 it('contrasts coil command with fuse / overload motor feedback',()=>{expect(run('fuse-failure').passed).toBe(true);expect(run('overload-trip').passed).toBe(true);});
 it('moves an actual product through the photoeye and exit',()=>{const r=run('conveyor-throughput');expect(r.passed).toBe(true);expect(r.checks.find(c=>c.name==='One product exits main lane')?.actual).toBe('1');});
 it('tests stopped product motion during belt slip, followed by repair',()=>{expect(run('belt-slip-recovery').passed).toBe(true);});
 it('identifies hazardous welded contactor without presenting STOP as safe',()=>{const r=run('welded-contactor');expect(r.passed).toBe(true);expect(r.checks.find(c=>c.name.startsWith('Hazard:'))?.actual).toBe('ON');expect(r.evidence.at(-1)?.motor).toBe(false);});
 it('fails a program that omits the sensor start permissive',()=>{const broken:LadderDocument={...workcellLadder,rungs:workcellLadder.rungs.map(r=>({...r,elements:r.elements.filter(e=>e.type!=='contact'||e.tag!=='SensorOK')}))};const r=runFactoryAcceptance(broken,'fixture',undefined,['sensor-loss']);expect(r.failed).toBe(1);expect(r.cases[0].checks.some(c=>!c.passed)).toBe(true);});
 it('fails a program that bypasses guard in PLC logic even if physical motor stops',()=>{const broken:LadderDocument={...workcellLadder,rungs:workcellLadder.rungs.map(r=>({...r,elements:r.elements.filter(e=>e.type!=='contact'||e.tag!=='GuardClosed')}))};const r=runFactoryAcceptance(broken,'fixture',undefined,['guard-restart']);expect(r.failed).toBe(1);expect(r.cases[0].checks.some(c=>c.name==='Open guard removes run request'&&!c.passed)).toBe(true);});
 it('fails disconnected learner board without silently borrowing fixture sensor',()=>{const r=runFactoryAcceptance(workcellLadder,'configured-board',unwired,['start-permissives']);expect(r.failed).toBe(1);expect(r.cases[0].checks.find(c=>c.name==='Sensor input is electrically present')?.actual).toBe('OFF');});
 it('passes configured learner board with actual powered PLC input wiring',()=>{const r=runFactoryAcceptance(workcellLadder,'configured-board',wired,['start-permissives']);expect(r.passed).toBe(1);});
 it('opens actual configured I0.2 wires during simulated sensor-loss test without altering original',()=>{const saved=JSON.stringify(wired);const r=runFactoryAcceptance(workcellLadder,'configured-board',wired,['sensor-loss']);expect(r.passed).toBe(1);expect(JSON.stringify(wired)).toBe(saved);});
 it('rejects absent configured board',()=>{expect(()=>runFactoryAcceptance(workcellLadder,'configured-board')).toThrow();});
 it('rejects duplicate, empty, or fabricated case lists',()=>{expect(()=>runFactoryAcceptance(workcellLadder,'fixture',undefined,[])).toThrow();expect(()=>runFactoryAcceptance(workcellLadder,'fixture',undefined,['sensor-loss','sensor-loss'])).toThrow();expect(()=>runFactoryAcceptance(workcellLadder,'fixture',undefined,['made-up' as never])).toThrow();});
 it('rejects invalid ladder documents and I/O mapping',()=>{expect(()=>runFactoryAcceptance({...workcellLadder,rungs:[]})).toThrow();expect(()=>runFactoryAcceptance({...workcellLadder,symbols:{Start:{description:'',address:'Q1.0'}}})).toThrow();});
 it('exports CSV reports with all criteria and evidence',()=>{const r=runFactoryAcceptance();const checks=fatChecksCsv(r),evidence=fatEvidenceCsv(r);expect(checks).toContain('criterion,expected,observed');expect(checks).toContain('welded-contactor');expect(evidence).toContain('timeMs');expect(evidence).toContain('press-stop');});
 it('quotes dangerous CSV characters instead of splitting cells',()=>{const r=runFactoryAcceptance(workcellLadder,'fixture',undefined,['start-permissives']);const c=r.cases[0];const data={...r,cases:[{...c,checks:[{...c.checks[0],name:'one,"two"\nthree'}]}]};expect(fatChecksCsv(data)).toContain('"one,""two""\nthree"');});
});
