import {describe,it,expect} from 'vitest';
import {auditLadder,auditCsv} from '../src/engineering/ladder-audit';
import type {LadderDocument,Rung} from '../src/engineering/ladder';
const rung=(id:string,coil:string,...tags:string[]):Rung=>({id,coil,elements:tags.map(tag=>({type:'contact',tag}))});
const document=(...rungs:Rung[]):LadderDocument=>({id:'audit-test',version:'1',rungs});
describe('static ladder audit',()=>{
 it('classifies external inputs and written coils',()=>{const a=auditLadder(document(rung('a','Motor','Start')));expect(a.externalInputs).toEqual(['Start']);expect(a.internalOutputs).toEqual(['Motor']);});
 it('flags forward references to later rungs',()=>expect(auditLadder(document(rung('a','A','B'),rung('b','B','Start'))).findings.some(f=>f.code==='PREVIOUS_SCAN_VALUE')).toBe(true));
 it('does not flag earlier-rung references',()=>expect(auditLadder(document(rung('b','B','Start'),rung('a','A','B'))).findings.some(f=>f.code==='PREVIOUS_SCAN_VALUE')).toBe(false));
 it('detects multi-rung cycles',()=>expect(auditLadder(document(rung('a','A','B'),rung('b','B','A'))).hasCycle).toBe(true));
 it('treats seal-in as informational',()=>expect(auditLadder(document(rung('a','A','A'))).findings.some(f=>f.code==='SELF_REFERENCE'&&f.severity==='info')).toBe(true));
 it('reports malformed programs rather than traversing them',()=>expect(auditLadder(document()).findings[0].severity).toBe('error'));
 it('exports readable CSV',()=>expect(auditCsv(auditLadder(document(rung('a','A','A'))))).toContain('SELF_REFERENCE'));
});
