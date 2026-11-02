import {describe,it,expect} from 'vitest';
import {generateMcdcVectors} from '../src/engineering/mcdc-vector-generator';
import {analyzeConditionIndependence} from '../src/engineering/condition-independence';
import {runLadderSequence} from '../src/engineering/ladder-sequences';
import type {LadderDocument} from '../src/engineering/ladder';
const doc:LadderDocument={id:'and',version:'1',rungs:[{id:'r',coil:'Y',elements:[{type:'contact',tag:'A'},{type:'contact',tag:'B'}]}]};
describe('generated MC/DC vectors',()=>{
 it('generates verified independent pairs',()=>{const v=generateMcdcVectors(doc);expect(v.witnesses).toHaveLength(2);expect(runLadderSequence(doc,v.steps).passed).toBe(true);expect(analyzeConditionIndependence(doc,v.steps).covered).toBe(2)});
 it('rejects invalid bounds',()=>expect(()=>generateMcdcVectors(doc,11)).toThrow());
 it('does not claim impossible independent conditions',()=>{const v=generateMcdcVectors({id:'x',version:'1',rungs:[{id:'r',coil:'Y',elements:[{type:'branch',alternatives:[[{type:'contact',tag:'A'}],[{type:'contact',tag:'B'}]]}]}]});expect(v.witnesses).toHaveLength(2)});
 it('excludes feedback',()=>expect(generateMcdcVectors({id:'x',version:'1',rungs:[{id:'r',coil:'Y',elements:[{type:'contact',tag:'Y'}]}]}).excluded).toHaveLength(1));
});
