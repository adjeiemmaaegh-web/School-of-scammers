import {describe,it,expect} from 'vitest';
import {exportPlcopenLadder,importPlcopenLadder} from '../src/engineering/plcopen-ld-xml';
import {executeLadder,validateLadder,conveyorStarter,type LadderDocument,type Contact} from '../src/engineering/ladder';
import {workcellLadder} from '../src/engineering/workcell';

const c=(tag:string,normallyClosed=false):Contact=>({type:'contact',tag,...(normallyClosed?{normallyClosed:true}:{})});
const small:LadderDocument={id:'Simple',version:'1',rungs:[
 {id:'first',elements:[c('Start'),c('Stop',true)],coil:'Run'},
 {id:'second',elements:[c('Run'),{type:'branch',alternatives:[[c('GuardClosed')],[c('Permit'),c('Aux',true)]]}],coil:'Lamp'}
]};
function compare(a:LadderDocument,b:LadderDocument,tags:readonly string[]){
 const names=[...new Set([...a.rungs.map(r=>r.coil),...b.rungs.map(r=>r.coil)])];
 for(let mask=0;mask<2**tags.length;mask++){
  const values=Object.fromEntries(tags.map((tag,i)=>[tag,Boolean(mask&(1<<i))]));
  const aa=executeLadder(a,values,{Run:false,RunLatch:false},{}).outputs;
  const bb=executeLadder(b,values,{Run:false,RunLatch:false},{}).outputs;
  expect(names.map(n=>aa[n]),JSON.stringify(values)).toEqual(names.map(n=>bb[n]));
 }
}
describe('bounded PLCopen graphical Ladder Diagram interchange',()=>{
 it('round-trips real seal-in and permissive scans without changing coil truth table',()=>{
  const xml=exportPlcopenLadder(conveyorStarter,'MotorProgram');
  expect(xml).toContain('http://www.plcopen.org/xml/tc6_0201');
  expect(xml).toContain('<LD>');
  expect(xml).toContain('negated="true"');
  const read=importPlcopenLadder(xml);
  expect(read.id).toBe('MotorProgram');
  expect(validateLadder(read)).toEqual([]);
  compare(conveyorStarter,read,['EStopOK','GuardClosed','Start','Stop','RunLatch']);
 });
 it('round-trips a multi-output PLC with AND and OR groups and preserves boolean semantics',()=>{
  const xml=exportPlcopenLadder(small,'ConveyorSorter');
  const roundtrip=importPlcopenLadder(xml);
  expect(roundtrip.rungs).toHaveLength(2);
  expect(roundtrip.rungs.map(r=>r.coil)).toEqual(['Run','Lamp']);
  compare(small,roundtrip,['Start','Stop','Run','GuardClosed','Permit','Aux']);
 });
 it('handles consecutive parallel blocks without inventing extra routes',()=>{
  const doc:LadderDocument={id:'two-branches',version:'1',rungs:[{
   id:'r1',coil:'Go',elements:[
    {type:'branch',alternatives:[[c('A')],[c('B')]]},
    {type:'branch',alternatives:[[c('C')],[c('D')]]},
    c('Permit')
   ]
  }]};
  const transformed=importPlcopenLadder(exportPlcopenLadder(doc));
  compare(doc,transformed,['A','B','C','D','Permit']);
  expect(transformed.rungs[0].elements.length).toBeGreaterThan(0);
 });
 it('imports an independently constructed parallel LD graph, not just its own output',()=>{
  const xml='<?xml version="1.0" encoding="UTF-8"?>'+
   '<project xmlns="http://www.plcopen.org/xml/tc6_0201">'+
   '<fileHeader/><contentHeader name="Sample"/>'+
   '<types><dataTypes/><pous><pou name="ExternalMotor" pouType="program">'+
   '<interface><inputVars><variable name="Start"><type><BOOL/></type></variable><variable name="Stop"><type><BOOL/></type></variable></inputVars>'+
   '<outputVars><variable name="Run"><type><BOOL/></type></variable></outputVars></interface><body><LD>'+
   '<leftPowerRail localId="0"><position x="0" y="0"/><connectionPointOut/></leftPowerRail>'+
   '<contact localId="3" negated="false"><position x="20" y="10"/><connectionPointIn><connection refLocalId="0"/></connectionPointIn><connectionPointOut/><variable>Start</variable></contact>'+
   '<contact localId="4" negated="false"><position x="20" y="20"/><connectionPointIn><connection refLocalId="0"/></connectionPointIn><connectionPointOut/><variable>Run</variable></contact>'+
   '<contact localId="5" negated="true"><position x="80" y="10"/><connectionPointIn><connection refLocalId="3"/><connection refLocalId="4"/></connectionPointIn><connectionPointOut/><variable>Stop</variable></contact>'+
   '<coil localId="6" negated="false"><position x="100" y="10"/><connectionPointIn><connection refLocalId="5"/></connectionPointIn><connectionPointOut/><variable>Run</variable></coil>'+
   '<rightPowerRail localId="7"><position x="150" y="0"/><connectionPointIn><connection refLocalId="6"/></connectionPointIn></rightPowerRail>'+
   '</LD></body></pou></pous></types><instances><configurations/></instances></project>';
  const read=importPlcopenLadder(xml);
  expect(read.rungs[0].elements[0].type).toBe('branch');
  expect(validateLadder(read)).toEqual([]);
  const expected:LadderDocument={id:'expected',version:'1',rungs:[{
   id:'latch',coil:'Run',elements:[
    {type:'branch',alternatives:[[c('Start')],[c('Run')]]},c('Stop',true)
   ]
  }]};
  compare(expected,read,['Start','Run','Stop']);
 });
 it('repeated XML export is deterministic and can be parsed in the existing production parser',()=>{
  expect(exportPlcopenLadder(small)).toBe(exportPlcopenLadder(small));
  expect(importPlcopenLadder(exportPlcopenLadder(small))).toEqual(importPlcopenLadder(exportPlcopenLadder(small)));
 });
 it('refuses unsupported timer/edge/counter semantics and reports metadata loss',()=>{
  const starter=importPlcopenLadder(exportPlcopenLadder(workcellLadder));
  expect(validateLadder(starter)).toEqual([]);
  const timed:LadderDocument={id:'x',version:'1',rungs:[{id:'delay',elements:[c('Start')],coil:'TimerDone',operation:{kind:'ton',presetMs:100}}]};
  expect(()=>exportPlcopenLadder(timed)).toThrow(/TON|instruction/);
  expect(()=>exportPlcopenLadder({...small,symbols:{Start:{description:'Start switch',address:'I0.0'}}})).toThrow(/metadata|symbol/);
  const override=exportPlcopenLadder({...small,symbols:{Start:{description:'Start'}}},'Example',{allowSymbolMetadataLoss:true});
  expect(importPlcopenLadder(override).symbols).toBeUndefined();
 });
 it('rejects opaque or malformed external PLCopen documents safely',()=>{
  const good=exportPlcopenLadder(small);
  for(const malformed of [
   good.replace('<LD>','<FBD>'),
   good.replace('</LD>','<block/></LD>'),
   good.replace('refLocalId="1"','refLocalId="999999"'),
   good.replace('localId="1"','localId="2"'),
   good.replace('storage="none"','storage="set"'),
   good.replace('edge="none"','edge="rising"'),
   good.replace(/(<coil[^>]*?)negated="false"/,'$1negated="true"'),
   good.replace('tc6_0201','tc6_0200'),
   '<!DOCTYPE note [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+good
  ])expect(()=>importPlcopenLadder(malformed),malformed.slice(0,50)).toThrow();
 });
 it('rejects unreferenced contacts and cycles, not just syntactically malformed XML',()=>{
  const good=exportPlcopenLadder(small);
  const orphan=good.replace('</LD>','<contact localId="1999"><position x="1" y="1"/><connectionPointIn><connection refLocalId="1"/></connectionPointIn><connectionPointOut/><variable>Start</variable></contact></LD>');
  expect(()=>importPlcopenLadder(orphan)).toThrow(/orphan|Unsupported/);
  const cycle=good.replace('<connection refLocalId="1"/>','<connection refLocalId="2"/>');
  expect(()=>importPlcopenLadder(cycle)).toThrow(/cyclic|invalid|Unsupported/);
 });
 it('rejects unsafe names and incompatible variable declarations',()=>{
  expect(()=>exportPlcopenLadder({...small,rungs:[{...small.rungs[0],coil:'Motor.Run'}]})).toThrow(/identifier/);
  const xml=exportPlcopenLadder(small);
  expect(()=>importPlcopenLadder(xml.replace('<BOOL/>','<REAL/>'))).toThrow(/BOOL|REAL/);
  expect(()=>importPlcopenLadder(xml.replace('name="Start"','name="Other"'))).toThrow(/undeclared|unused/);
 });
});
