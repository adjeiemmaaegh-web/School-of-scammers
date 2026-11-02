import type {WorkcellState,WorkcellAction} from './workcell';
export type CommissionStage='prepare'|'wire'|'start'|'transfer'|'stop'|'complete';
export type Evidence={stage:CommissionStage;scan:number;timeMs:number;detail:string;completedCount:number};
export type CommissionRecord={evidence:readonly Evidence[];faults:readonly string[];passed:boolean};
export const initialCommissionRecord=():CommissionRecord=>({evidence:[],faults:[],passed:false});
export const commissionStages:readonly {id:CommissionStage;title:string;instruction:string}[]=[
{id:'prepare',title:'01 · Prepare and isolate',instruction:'Isolate the 24 V supply and confirm the conveyor is stopped.'},
{id:'wire',title:'02 · Verify the sensor',instruction:'With power isolated, connect the sensor cable and wire its signal to I0.2 and return to M0.'},
{id:'start',title:'03 · Start and verify',instruction:'Restore power, close the guard and start the motor. Verify PLC feedback.'},
{id:'transfer',title:'04 · Process a product',instruction:'Introduce a product, advance scans until it clears the conveyor, and verify the completed counter.'},
{id:'stop',title:'05 · Safe shutdown',instruction:'Stop the motor and isolate the supply after production.'},
{id:'complete',title:'06 · Review evidence',instruction:'Review the recorded evidence. Completion is awarded only for observed simulation states.'}
];
export function commissionStage(record:CommissionRecord):CommissionStage {return commissionStages[Math.min(record.evidence.length,5)].id;}
export function inspectCommission(record:CommissionRecord,state:WorkcellState,action?:WorkcellAction):CommissionRecord {
 const stage=commissionStage(record);if(stage==='complete')return record;
 const last=record.evidence[record.evidence.length-1];
 // A commissioning step must be supported by a later PLC scan, not repeated captures of one snapshot.
 if(last && (state.scan<=last.scan || state.timeMs<=last.timeMs))return record;
 let ok=false,detail='';
 switch(stage){
 case 'prepare':ok=!state.powerOn&&!state.motor;detail='Supply isolated; motor stopped';break;
 case 'wire':ok=!state.powerOn&&state.sensorConnected&&state.terminalWiring.sensorPositive==='I0.2'&&state.terminalWiring.sensorReturnConnected;detail='Sensor connected to I0.2 with return';break;
 case 'start':ok=state.powerOn&&state.guardClosed&&state.motor&&state.plcInputs.SensorOK===true&&state.plcOutputs.MotorContactor===true;detail='Motor and PLC feedback confirmed';break;
 case 'transfer':ok=state.process.completed>(last?.completedCount??0)&&state.process.motorFeedback;detail=`Completed products: ${state.process.completed}`;break;
 case 'stop':ok=!state.powerOn&&!state.motor&&state.process.completed>0;detail='Motor stopped; supply isolated after transfer';break;
 }
 if(!ok)return record;
 const evidence=[...record.evidence,{stage,scan:state.scan,timeMs:state.timeMs,detail,completedCount:state.process.completed}];
 return {...record,evidence,passed:evidence.length===5};
}
export function commissioningIssues(state:WorkcellState):string[]{const issues:string[]=[];
 if(state.powerOn)issues.push('Supply energized');if(state.motor)issues.push('Motor running');
 if(!state.sensorConnected)issues.push('Sensor cable disconnected');
 if(state.terminalWiring.sensorPositive!=='I0.2')issues.push('Sensor not mapped to I0.2');
 if(!state.terminalWiring.sensorReturnConnected)issues.push('Sensor return open');
 if(!state.guardClosed)issues.push('Guard open');
 for(const [fault,active] of Object.entries(state.process.faults))if(active)issues.push(`Process fault: ${fault}`);
 for(const [fault,active] of Object.entries(state.starter.faults))if(active)issues.push(`Starter fault: ${fault}`);
 return issues;
}
