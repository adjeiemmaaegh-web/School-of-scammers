import {describe,it,expect} from 'vitest';
import {injectInputBounce,BOUNCE_EXAMPLE} from '../src/engineering/input-bounce';
import {SEQUENCE_EXAMPLES} from '../src/engineering/ladder-sequences';
const steps=SEQUENCE_EXAMPLES['start-stop'];
describe('deterministic input bounce injection',()=>{
 it('preserves the original sequence',()=>{const before=JSON.stringify(steps);injectInputBounce(steps,BOUNCE_EXAMPLE);expect(JSON.stringify(steps)).toBe(before);});
 it('creates bounded alternating transitions and settling',()=>{const r=injectInputBounce(steps,BOUNCE_EXAMPLE);expect(r.timeline.map(t=>t.value)).toEqual([false,true,false,true,true]);expect(r.injectedScans).toBe(6);});
 it('preserves original expectations at the delayed checkpoint',()=>{const r=injectInputBounce(steps,BOUNCE_EXAMPLE);expect(r.steps[6].expect).toEqual({RunLatch:true});});
 it('rejects a step without an explicit target assignment',()=>expect(()=>injectInputBounce(steps,{...BOUNCE_EXAMPLE,atStep:1})).toThrow());
 it('rejects an unchanged target state',()=>expect(()=>injectInputBounce([{scans:1,inputs:{A:true}},{scans:1,inputs:{A:true}}],{tag:'A',atStep:2,transitions:2,settleScans:1})).toThrow());
 it('rejects unbounded transitions',()=>expect(()=>injectInputBounce(steps,{...BOUNCE_EXAMPLE,transitions:21})).toThrow());
});
