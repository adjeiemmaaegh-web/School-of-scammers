/**
 * R12/R19 operator interface devices: potentiometer, 3-position selector, seven-segment and numeric displays, a pushbutton
 * station and an indicator panel. Operators act on them through device settings (a knob angle, a switch position, a held
 * button) and the PLC sees real electrical/analog signals; displays show what the PLC drives. Educational 24V models.
 * Outputs are decided in `step` (where the active fault is known) and stored in the equipment state: `phase` holds a bit mask.
 */
import type {EquipmentDef} from '../world/equipment';
import {flag,initial,numeric,param,spec} from '../world/equipment';
import {clamp,q,vec} from '../world/math';
import type {EquipmentDrawing,Vec3} from '../world/types';

const box=(ctx:{originMm:Vec3;yawDeg:0|90|180|270},part:string,dx:number,z:number,size:Vec3,colour:string):EquipmentDrawing=>
 ({part,shape:'box',pos:{x:ctx.originMm.x+dx,y:ctx.originMm.y,z:ctx.originMm.z+z},size,yawDeg:ctx.yawDeg,colour});
const bit=(mask:number|undefined,n:number):boolean=>((mask??0)>>n&1)===1;

export const potentiometer:EquipmentDef={
 kind:'potentiometer',label:'Potentiometer (0-10 V analog control)',footprint:vec(120,120,100),
 commands:[],signals:[{name:'volts',kind:'number',unit:'V'},{name:'percent',kind:'number',unit:'%'}],
 params:[spec('positionPct','Knob position','%',0,100,1,0),spec('rangeV','Full-scale voltage','V',5,10,5,10)],
 faults:['wiper-open','wiper-stuck'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  // A stuck wiper holds the last reading however the knob is turned; an open wiper reads 0 V.
  const pct=f==='wiper-stuck'?s.progress*100:f==='wiper-open'?0:param(ctx,'positionPct',0);
  return {world:w,state:{...s,progress:q(pct/100),value:q(pct/100*param(ctx,'rangeV',10)),faulted:!!f,stalled:f==='wiper-stuck'}};
 },
 read:s=>({volts:s.value,percent:q(s.progress*100)}),
 describe:(s,ctx)=>[box(ctx,'body',0,50,vec(110,110,100),'#6b6f7a'),box(ctx,'knob',0,110,vec(60,60,30),s.faulted?'#b24a3a':'#d9a441')],
};

export const selector3:EquipmentDef={
 kind:'selector-3pos',label:'3-position selector (left / off / right)',footprint:vec(120,120,100),
 commands:[],signals:[{name:'left',kind:'bool'},{name:'centre',kind:'bool'},{name:'right',kind:'bool'}],
 params:[spec('position','Switch position','0=left, 1=centre, 2=right',0,2,1,1)],
 faults:['left-contact-dead','right-contact-dead'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const pos=param(ctx,'position',1);
  const mask=(pos===0&&f!=='left-contact-dead'?1:0)|(pos===1?2:0)|(pos===2&&f!=='right-contact-dead'?4:0);
  return {world:w,state:{...s,value:pos,phase:mask,faulted:!!f}};
 },
 read:s=>({left:bit(s.phase,0),centre:bit(s.phase,1),right:bit(s.phase,2)}),
 describe:(s,ctx)=>[box(ctx,'body',0,50,vec(110,110,100),'#555b66'),box(ctx,'lever',(s.value-1)*30,110,vec(30,30,50),s.value===1?'#9aa0a8':'#e0b13a')],
};

/** Segment patterns a..g (bit 0 = a) for the digits 0-9 on a standard seven-segment display. */
export const SEGMENTS:readonly number[]=[0b0111111,0b0000110,0b1011011,0b1001111,0b1100110,0b1101101,0b1111101,0b0000111,0b1111111,0b1101111];
export const sevenSegment:EquipmentDef={
 kind:'seven-segment',label:'Seven-segment display (BCD input)',footprint:vec(120,160,200),
 commands:[{name:'b0',kind:'bool'},{name:'b1',kind:'bool'},{name:'b2',kind:'bool'},{name:'b3',kind:'bool'},{name:'blank',kind:'bool'},{name:'lampTest',kind:'bool'}],
 signals:[...'abcdefg'.split('').map(n=>({name:'seg'+n.toUpperCase(),kind:'bool' as const})),{name:'digit',kind:'number'},{name:'invalid',kind:'bool'}],
 params:[],
 faults:['segment-c-dead','display-off'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f)=>{
  const code=(flag(c,'b0')?1:0)+(flag(c,'b1')?2:0)+(flag(c,'b2')?4:0)+(flag(c,'b3')?8:0);
  const invalid=code>9&&!flag(c,'blank');
  let mask=flag(c,'blank')||invalid?0:SEGMENTS[code];
  if(flag(c,'lampTest'))mask=0b1111111;
  if(f==='segment-c-dead')mask&=~0b0000100;
  if(f==='display-off')mask=0;
  return {world:w,state:{...s,phase:mask,value:flag(c,'blank')||invalid?-1:code,done:invalid,faulted:!!f}};
 },
 read:s=>({...Object.fromEntries('abcdefg'.split('').map((n,i)=>['seg'+n.toUpperCase(),bit(s.phase,i)])),digit:s.value,invalid:s.done}),
 describe:(s,ctx)=>[box(ctx,'body',0,100,vec(110,40,200),'#1c2230'),box(ctx,'lit',0,100,vec(70,45,150),(s.phase??0)?'#e8453c':'#3a2428')],
};

export const numericDisplay:EquipmentDef={
 kind:'numeric-display',label:'Numeric display / bar meter',footprint:vec(200,60,100),
 commands:[{name:'value',kind:'number'}],
 signals:[{name:'shown',kind:'number'},{name:'fraction',kind:'number'},{name:'over',kind:'bool'}],
 params:[spec('decimals','Decimal places','digits',0,3,1,1),spec('fullScale','Full scale','units',1,10000,1,100)],
 faults:['display-frozen','display-off'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const scale=param(ctx,'fullScale',100),decimals=param(ctx,'decimals',1);
  const wanted=numeric(c,'value',0,-1e6,1e6);
  const raw=f==='display-frozen'?s.value:f==='display-off'?0:wanted;
  const shown=Math.round(raw*10**decimals)/10**decimals;
  return {world:w,state:{...s,value:shown,progress:q(clamp(shown/scale,0,1)),done:shown>scale,faulted:!!f}};
 },
 read:s=>({shown:s.value,fraction:s.progress,over:s.done}),
 describe:(s,ctx)=>[box(ctx,'body',0,50,vec(190,50,100),'#1c2230'),box(ctx,'bar',-95+95*s.progress,50,vec(Math.max(4,190*s.progress),52,60),s.done?'#d9534f':'#5fb589')],
};

export const operatorStation:EquipmentDef={
 kind:'operator-station',label:'Pushbutton station (start / stop / reset + 2 lamps)',footprint:vec(260,120,180),
 commands:[{name:'greenLamp',kind:'bool'},{name:'redLamp',kind:'bool'}],
 signals:[{name:'start',kind:'bool'},{name:'stop',kind:'bool'},{name:'reset',kind:'bool'},{name:'greenLit',kind:'bool'},{name:'redLit',kind:'bool'}],
 params:[spec('startPressed','START held','0=released, 1=pressed',0,1,1,0),spec('stopPressed','STOP held','0=released, 1=pressed',0,1,1,0),
  spec('resetPressed','RESET held','0=released, 1=pressed',0,1,1,0)],
 faults:['start-stuck','stop-contact-welded','green-lamp-burnt'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f,ctx)=>{
  const start=param(ctx,'startPressed',0)===1||f==='start-stuck';
  // STOP is a normally-closed contact: it reads true while released and opens when pressed. A welded contact never opens.
  const stop=param(ctx,'stopPressed',0)===1&&f!=='stop-contact-welded';
  const mask=(start?1:0)|(!stop?2:0)|(param(ctx,'resetPressed',0)===1?4:0)|(flag(c,'greenLamp')&&f!=='green-lamp-burnt'?8:0)|(flag(c,'redLamp')?16:0);
  return {world:w,state:{...s,phase:mask,faulted:!!f}};
 },
 read:s=>({start:bit(s.phase,0),stop:bit(s.phase,1),reset:bit(s.phase,2),greenLit:bit(s.phase,3),redLit:bit(s.phase,4)}),
 describe:(s,ctx)=>[box(ctx,'panel',0,90,vec(250,100,180),'#4a4f5a'),
  box(ctx,'start',-80,185,vec(40,40,20),bit(s.phase,0)?'#2e7d4f':'#3f9a63'),box(ctx,'stop',-30,185,vec(40,40,20),!bit(s.phase,1)?'#8a2a24':'#c0392b'),
  box(ctx,'green',30,185,vec(36,36,20),bit(s.phase,3)?'#7dff9a':'#27402f'),box(ctx,'red',80,185,vec(36,36,20),bit(s.phase,4)?'#ff6a5e':'#40282a')],
};

const LAMP_COLOURS=['#5fd07a','#f0c93b','#ef5b50','#4f9be8'];
export const indicatorPanel:EquipmentDef={
 kind:'indicator-panel',label:'Indicator panel (4 lamps + horn)',footprint:vec(320,80,140),
 commands:[{name:'lamp1',kind:'bool'},{name:'lamp2',kind:'bool'},{name:'lamp3',kind:'bool'},{name:'lamp4',kind:'bool'},{name:'horn',kind:'bool'},{name:'lampTest',kind:'bool'}],
 signals:[{name:'lit1',kind:'bool'},{name:'lit2',kind:'bool'},{name:'lit3',kind:'bool'},{name:'lit4',kind:'bool'},{name:'hornOn',kind:'bool'},{name:'litCount',kind:'number'}],
 params:[],
 faults:['lamp1-burnt','lamp3-burnt','horn-dead'],
 fresh:()=>initial({}),
 step:(s,w,c,dt,f)=>{
  const test=flag(c,'lampTest');
  const lamps=[1,2,3,4].map(n=>(test||flag(c,'lamp'+n))&&f!==`lamp${n}-burnt`);
  const horn=(test||flag(c,'horn'))&&f!=='horn-dead';
  const mask=lamps.reduce((m,on,i)=>m|(on?1<<i:0),0)|(horn?16:0);
  return {world:w,state:{...s,phase:mask,value:lamps.filter(Boolean).length,faulted:!!f}};
 },
 read:s=>({lit1:bit(s.phase,0),lit2:bit(s.phase,1),lit3:bit(s.phase,2),lit4:bit(s.phase,3),hornOn:bit(s.phase,4),litCount:s.value}),
 describe:(s,ctx)=>[box(ctx,'panel',0,70,vec(310,70,140),'#3d424d'),
  ...LAMP_COLOURS.map((c,i)=>box(ctx,'lamp'+(i+1),-105+i*70,150,vec(46,46,20),bit(s.phase,i)?c:'#2a2e36')),
  box(ctx,'horn',125,150,vec(40,40,20),bit(s.phase,4)?'#f7f7f7':'#555')],
};
export const OPERATOR_DEVICES=[potentiometer,selector3,sevenSegment,numericDisplay,operatorStation,indicatorPanel];
