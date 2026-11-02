import {describe,it,expect} from 'vitest';
import {initialWorkcell,stepWorkcell} from '../src/engineering/workcell';
import {createRecorder,recordScan,detectEdges,csvRecorder,signalStats} from '../src/engineering/scan-instruments';
describe('deterministic scan instruments',()=>{
 it('samples motor, supply and feedback from actual workcell',()=>{const s=initialWorkcell();const r=recordScan(createRecorder(),s);expect(r.samples[0].values.power).toBe(24);expect(r.samples[0].values.motor).toBe(0);});
 it('requires monotonic scans and time',()=>{const s=initialWorkcell();const r=recordScan(createRecorder(),s);expect(()=>recordScan(r,s)).toThrow();});
 it('records digital power transitions and exports CSV',()=>{let s=initialWorkcell(),r=createRecorder();r=recordScan(r,s);s=stepWorkcell(s,'restore-power');r=recordScan(r,s);expect(detectEdges(r,'motor')).toHaveLength(0);expect(detectEdges(r,'sensor')).toHaveLength(0);expect(csvRecorder(r,['power'])).toContain('scan,time_ms,power');expect(signalStats(r,'power')?.max).toBe(24);});
 it('caps samples without mutating earlier snapshots',()=>{let s=initialWorkcell(),r=createRecorder(3);for(let i=0;i<5;i++){r=recordScan(r,s);s=stepWorkcell(s,'tick');}expect(r.samples).toHaveLength(3);expect(r.samples[0].scan).toBe(2);});
 it('rejects invalid signal and capacity',()=>{expect(()=>createRecorder(1)).toThrow();expect(()=>csvRecorder(createRecorder(),['fake'])).toThrow();expect(()=>detectEdges(createRecorder(),'power')).toThrow();});
});
