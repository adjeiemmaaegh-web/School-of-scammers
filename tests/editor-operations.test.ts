import { describe, expect, it } from 'vitest';
import { insertElement, moveElement, moveRung } from '../src/engineering/editor-operations';
import type { LadderDocument } from '../src/engineering/ladder';
const doc: LadderDocument = {id:'test',version:'1',rungs:[{id:'a',coil:'RunLatch',elements:[{type:'contact',tag:'Start'},{type:'contact',tag:'Stop'}]},{id:'b',coil:'Aux1',elements:[{type:'contact',tag:'GuardClosed'}]}]};
describe('immutable ladder editing',()=>{
 it('reorders elements without mutating source',()=>{const next=moveElement(doc,0,0,1);expect(next.rungs[0].elements[0]).toEqual({type:'contact',tag:'Stop'});expect(doc.rungs[0].elements[0]).toEqual({type:'contact',tag:'Start'});});
 it('inserts a contact at requested position',()=>{const next=insertElement(doc,0,1,{type:'contact',tag:'PowerOK'});expect(next.rungs[0].elements.map(e=>e.type==='contact'?e.tag:'branch')).toEqual(['Start','PowerOK','Stop']);});
 it('reorders rungs preserving ids',()=>{expect(moveRung(doc,0,1).rungs.map(r=>r.id)).toEqual(['b','a']);});
 it('rejects invalid coordinates without changes',()=>{expect(moveElement(doc,0,-1,1)).toBe(doc);expect(insertElement(doc,9,0,{type:'contact',tag:'Start'})).toBe(doc);});
});
