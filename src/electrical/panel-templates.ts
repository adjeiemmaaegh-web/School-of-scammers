/** Original source plans; NOT auto-wired hidden animations or field wiring procedures. */
export type PanelTemplate={id:string;title:string;notes:string;
 parts:{id:string;kind:string;x:number;y:number}[];
 wires:{id:string;from:string;to:string}[]};
export const STAR_DELTA_PANEL:PanelTemplate={
 id:'star-delta-3phase',title:'24V-controlled three-phase star/delta teaching panel',
 notes:'Independent 24V and three-phase domains; terminal-by-terminal learner wiring.',
 parts:[
  {id:'control',kind:'supply',x:10,y:10},
  {id:'mains',kind:'three-phase-supply',x:10,y:250},
  {id:'plc16',kind:'plc16',x:290,y:10},
  {id:'drive',kind:'star-delta-drive',x:650,y:200},
  {id:'start',kind:'start',x:260,y:250},
  {id:'stop',kind:'stop',x:460,y:250},
 ],
 wires:[
  {id:'power-plc',from:'control.P24',to:'plc16.L+'},
  {id:'return-plc',from:'control.M0',to:'plc16.M'},
  {id:'start-feed',from:'control.P24',to:'start.A'},
  {id:'start-input',from:'start.B',to:'plc16.I0.0'},
  {id:'stop-feed',from:'control.P24',to:'stop.A'},
  {id:'stop-input',from:'stop.B',to:'plc16.I0.1'},
  {id:'coil-return',from:'control.M0',to:'drive.M-'},
  {id:'coil-main',from:'plc16.Q0.0',to:'drive.MAIN+'},
  {id:'coil-star',from:'plc16.Q0.1',to:'drive.STAR+'},
  {id:'coil-delta',from:'plc16.Q0.2',to:'drive.DELTA+'},
  {id:'drive-l1',from:'mains.L1',to:'drive.L1'},
  {id:'drive-l2',from:'mains.L2',to:'drive.L2'},
  {id:'drive-l3',from:'mains.L3',to:'drive.L3'},
  {id:'drive-pe',from:'mains.PE',to:'drive.PE'},
 ],
};
export const STAR_DELTA_ST=[
 'VAR_INPUT','  In0 : BOOL;','  In1 : BOOL;','END_VAR',
 'VAR_OUTPUT','  Out0 : BOOL;','  Out1 : BOOL;','  Out2 : BOOL;','END_VAR',
 'VAR','  Latched : BOOL := FALSE;','  Count : DINT := 0;','END_VAR',
 'IF NOT In1 THEN',' Latched := FALSE;',' Count := 0;',
 'ELSIF In0 THEN',' Latched := TRUE;','END_IF;',
 'IF Latched AND Count < 100000 THEN',' Count := Count + 1;','END_IF;',
 'Out0 := Latched;',
 'Out1 := Latched AND Count < 50;',
 'Out2 := Latched AND Count >= 54;',
].join('\n');
/** Convert to typed worker commands after validating each component/wire. */
export const buildPanelTemplateCommands=(template:PanelTemplate):Array<
 {k:'place';id:string;kind:string;at:{x:number;y:number}}|
 {k:'wire';id:string;from:string;to:string}>=>
 [...template.parts.map(part=>({k:'place' as const,id:part.id,kind:part.kind,
  at:{x:part.x,y:part.y}})),...template.wires.map(w=>({k:'wire' as const,...w}))];
