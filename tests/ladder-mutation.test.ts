import {describe,it,expect} from 'vitest';
import {assessSequenceMutations,generateLadderMutants,mutationReportCsv} from '../src/engineering/ladder-mutation';
import {conveyorStarter} from '../src/engineering/ladder';
import {SEQUENCE_EXAMPLES} from '../src/engineering/ladder-sequences';
describe('PLC sequence mutation analysis',()=>{
 it('generates deterministic contact inversions without altering original',()=>{const before=JSON.stringify(conveyorStarter);const a=generateLadderMutants(conveyorStarter);expect(a.length).toBeGreaterThan(0);expect(a.map(m=>m.id)).toEqual(generateLadderMutants(conveyorStarter).map(m=>m.id));expect(JSON.stringify(conveyorStarter)).toBe(before);});
 it('identifies defects detected by start-stop expectations',()=>{const r=assessSequenceMutations(conveyorStarter,SEQUENCE_EXAMPLES['start-stop']);expect(r.total).toBeGreaterThan(0);expect(r.detected).toBeGreaterThan(0);expect(r.detected+r.survived).toBe(r.total);});
 it('reports survivors for weak expectations',()=>{const r=assessSequenceMutations(conveyorStarter,[{scans:1,inputs:{},expect:{}}]);expect(r.survived).toBe(r.total);});
 it('rejects a failing baseline',()=>{expect(()=>assessSequenceMutations(conveyorStarter,[{scans:1,inputs:{},expect:{RunLatch:true}}])).toThrow(/Baseline/);});
 it('exports escaped CSV',()=>{const r=assessSequenceMutations(conveyorStarter,SEQUENCE_EXAMPLES['start-stop']);expect(mutationReportCsv(r)).toContain('first_failing_step');});
});
