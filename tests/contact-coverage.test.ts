import {describe,it,expect} from 'vitest';
import {analyzeContactCoverage,contactCoverageCsv} from '../src/engineering/contact-coverage';
import type {LadderDocument} from '../src/engineering/ladder';
const doc:LadderDocument={id:'contact-test',version:'1',rungs:[{id:'r1',coil:'Q',elements:[{type:'contact',tag:'A'},{type:'branch',alternatives:[[{type:'contact',tag:'B'}],[{type:'contact',tag:'C',normallyClosed:true}]]}]}]};
describe('contact and branch path coverage',()=>{
 it('records contact occurrence states and path outcomes',()=>{const report=analyzeContactCoverage(doc,[{scans:1,inputs:{A:false,B:false,C:false}},{scans:2,inputs:{A:true,B:true,C:true}}]);expect(report.scans).toBe(3);expect(report.contactBoth).toBe(3);expect(report.pathBoth).toBe(3);expect(report.contacts[2].firstBlocked).toBe(2);});
 it('exports a CSV with distinct path and contact rows',()=>{const csv=contactCoverageCsv(analyzeContactCoverage(doc,[{scans:1,inputs:{A:true,B:false,C:false}}]));expect(csv).toContain('contact');expect(csv).toContain('path');});
 it('rejects attempts to force outputs',()=>expect(()=>analyzeContactCoverage(doc,[{scans:1,inputs:{Q:true}}])).toThrow('cannot force output'));
 it('enforces the scan budget',()=>expect(()=>analyzeContactCoverage(doc,[{scans:1001,inputs:{}}])).toThrow('scan budget'));
 it('rejects nonboolean inputs',()=>expect(()=>analyzeContactCoverage(doc,[{scans:1,inputs:{A:1 as unknown as boolean}}])).toThrow('invalid signal'));
});
