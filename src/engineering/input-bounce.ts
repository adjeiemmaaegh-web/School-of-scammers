/** Deterministic simulated switch-bounce injection into PLC input test sequences. */
import type {VectorStep} from './ladder-sequences';
export type BounceConfig={tag:string;atStep:number;transitions:number;settleScans:number};
export type BounceResult={steps:VectorStep[];injectedScans:number;totalScans:number;timeline:{scan:number;value:boolean;phase:string}[]};
const validTag=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z][\w.]{0,79}$/.test(s);
export function injectInputBounce(steps:readonly VectorStep[],config:BounceConfig):BounceResult{
 if(!Array.isArray(steps)||steps.length<1||steps.length>100)throw RangeError('Sequence must contain 1..100 steps');
 if(!config||!validTag(config.tag)||!Number.isSafeInteger(config.atStep)||config.atStep<1||config.atStep>steps.length||!Number.isSafeInteger(config.transitions)||config.transitions<1||config.transitions>20||!Number.isSafeInteger(config.settleScans)||config.settleScans<1||config.settleScans>1000)throw RangeError('Invalid bounce configuration');
 let previous:Record<string,boolean>={};let total=0;
 for(const [i,step] of steps.entries()){
  if(!step||!Number.isSafeInteger(step.scans)||step.scans<1||step.scans>1000||!step.inputs||typeof step.inputs!=='object'||Array.isArray(step.inputs)||Object.keys(step.inputs).length>64)throw Error(`Invalid sequence step ${i+1}`);
  for(const [tag,value] of Object.entries(step.inputs))if(!validTag(tag)||typeof value!=='boolean')throw Error(`Invalid input ${tag}`);
  if(i<config.atStep-1){total+=step.scans;previous={...previous,...step.inputs};}
 }
 const target=steps[config.atStep-1];
 if(!Object.prototype.hasOwnProperty.call(target.inputs,config.tag))throw Error('Selected step must explicitly set the bouncing input');
 const desired=target.inputs[config.tag];
 if((previous[config.tag]??false)===desired)throw Error('Selected step must change the input state');
 const added=config.transitions+config.settleScans;
 const originalScans=steps.reduce((n,s)=>n+s.scans,0);
 if(originalScans+added>10000||steps.length+config.transitions+2>100)throw RangeError('Bounce would exceed sequence limits');
 const result:VectorStep[]=steps.slice(0,config.atStep-1).map(s=>({...s,inputs:{...s.inputs},expect:s.expect?{...s.expect}:undefined}));
 const timeline:BounceResult['timeline']=[];
 const firstInputs={...target.inputs};delete firstInputs[config.tag];
 // Inject alternating incorrect/correct values before the final stable state.
 for(let j=0;j<config.transitions;j++){
  const value=j%2===0?!desired:desired;
  result.push({scans:1,inputs:{...(j===0?firstInputs:{}),[config.tag]:value}});
  timeline.push({scan:total+j+1,value,phase:'bounce'});
 }
 result.push({scans:config.settleScans,inputs:{[config.tag]:desired}});
 timeline.push({scan:total+config.transitions+1,value:desired,phase:'settled'});
 result.push({scans:target.scans,inputs:{},expect:target.expect?{...target.expect}:undefined});
 result.push(...steps.slice(config.atStep).map(s=>({...s,inputs:{...s.inputs},expect:s.expect?{...s.expect}:undefined})));
 return {steps:result,injectedScans:added,totalScans:originalScans+added,timeline};
}
export const BOUNCE_EXAMPLE:BounceConfig={tag:'Start',atStep:2,transitions:4,settleScans:2};
