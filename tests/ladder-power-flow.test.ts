import { describe, expect, it } from 'vitest';
import { executeLadder, type LadderDocument } from '../src/engineering/ladder';
const program: LadderDocument = {id:'trace',version:'1',rungs:[{id:'r1',elements:[{type:'contact',tag:'Enable'},{type:'branch',alternatives:[[{type:'contact',tag:'A'}],[{type:'contact',tag:'B',normallyClosed:true}]]}],coil:'Motor'}]};
describe('power flow inspection',()=>{
 it('records contact samples and OR branch conduction',()=>{const result=executeLadder(program,{Enable:true,A:false,B:false});expect(result.outputs.Motor).toBe(true);expect(result.steps[0].elements[1].paths[0][0].conducts).toBe(false);expect(result.steps[0].elements[1].paths[1][0].conducts).toBe(true);});
 it('records open series contacts even when an earlier contact is open',()=>{const result=executeLadder(program,{Enable:false,A:true,B:true});expect(result.outputs.Motor).toBe(false);expect(result.steps[0].elements).toHaveLength(2);expect(result.steps[0].elements[1].conducts).toBe(true);});
 it('is deterministic across equivalent inputs',()=>{expect(executeLadder(program,{Enable:true,A:true,B:true}).steps).toEqual(executeLadder(program,{Enable:true,A:true,B:true}).steps);});
});
