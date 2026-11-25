import type {ComponentKind} from '../components/registry';
export type GuideBuild={
 id:string;title:string;goal:string;level:'Foundation'|'Intermediate';
 minutes:number;devices:readonly ComponentKind[];optional?:readonly ComponentKind[];
 whatToDo:readonly string[];observableResult:string;commonMistake:string;
 practiceRoute:string;practiceLabel:string;sceneId?:string;topicId:string;
}
/** Task-based equipment selection, NOT a pre-wired project or assessment answer key. */
export const GUIDE_BUILDS:readonly GuideBuild[]=[
{id:'first-lamp',title:'Light a virtual 24 V lamp',goal:'Complete a circuit before adding a PLC.',level:'Foundation',minutes:12,
 devices:['supply','start','lamp'],
 whatToDo:['Back up your project before starting blank.','Place supply, NO START and pilot lamp.','Logical/Wire: P24 → START A, START B → lamp L+, lamp M- → supply M0.','Run, press/release START and inspect the lamp.'],
 observableResult:'Lamp on only with START pressed and the virtual loop complete.',
 commonMistake:'Nearby lamps need a closed circuit.',
 practiceRoute:'/sandbox',practiceLabel:'Open an empty or existing simulator',topicId:'first-lamp'},
{id:'motor-starter',title:'Run and stop a virtual motor',goal:'PLC I/O and contactor motor control.',level:'Foundation',minutes:25,
 devices:['supply','plc','start','stop','contactor','motor'],optional:['lamp','breaker','overload'],
 whatToDo:['Use a named backup or the motor-starter lesson.','Inspect PLC L+/M, I/O and contactor coil/contact.','Wire per the lesson work order; choose a supported program.','Run START and STOP; watch I/O, contactor and motor.'],
 observableResult:'Correct wiring and logic drive the motor; STOP stops it.',
 commonMistake:'Q0.0 needs PLC power and complete output/contactor wiring.',
 practiceRoute:'/scenario/plc-sbx-startstop',practiceLabel:'Open motor starter guided scenario',topicId:'plc-basics'},
{id:'factory-sort',title:'Sort objects on a conveyor',goal:'Material flow, photoeyes and PLC-controlled diverters.',level:'Intermediate',minutes:30,
 devices:['box-feeder','belt-conveyor','geometry-photoeye','diverter-gate','plc16'],
 whatToDo:['Save your project; open Photoeye and diverting line.','Inspect feeder, conveyor, photoeye and diverter.','Map scene signals to PLC I/O and command actuators.','Run objects; check sensors and sorting behavior.'],
 observableResult:'Sensors detect objects; a correctly commanded diverter changes their route.',
 commonMistake:'Scenes are not solved factories; reference code is not proof of scan outcomes.',
 practiceRoute:'/sandbox',practiceLabel:'Open simulator scene gallery',sceneId:'sorting-line',topicId:'factory-scenes'},
{id:'tank-control',title:'Control the level in a tank',goal:'Pump, level sensor, valve and PLC control.',level:'Intermediate',minutes:30,
 devices:['supply','plc','tank','pump','levelprobe','drainvalve'],
 whatToDo:['Use the tank work order, not a solved project.','Identify level, pump and valve terminals.','Wire PLC and power; implement supported logic.','Watch high-level input, inlet/outlet and liquid level over scans.'],
 observableResult:'Level follows wiring, PLC logic and process state.',
 commonMistake:'Displays and reference code cannot replace powered pump/valve wiring.',
 practiceRoute:'/scenario/plc-sbx-tank',practiceLabel:'Open tank level scenario',topicId:'plc-basics'},
{id:'cylinder',title:'Move a pneumatic cylinder',goal:'Solenoid commands and end limit switches.',level:'Intermediate',minutes:25,
 devices:['supply','plc','cylinder'],optional:['stacklight'],
 whatToDo:['Inspect EXT+, RET+, M-, EXT_LS and RET_LS.','Try the pneumatics lab, then the sandbox cylinder.','Wire PLC outputs to solenoids and inputs to end limits.','Run, check end limits; pause to diagnose missing commands.'],
 observableResult:'Valid control paths change the cylinder position.',
 commonMistake:'Air is assumed; not complete pneumatic design or a physical pressure test.',
 practiceRoute:'/labs/pneumatics',practiceLabel:'Open pneumatics lab',topicId:'wire-safely'},
{id:'diagnostic-mission',title:'Diagnose a stopped starter',goal:'Trace signals with the virtual meter.',level:'Intermediate',minutes:25,
 devices:['supply','plc','contactor','motor'],optional:['start','stop','lamp'],
 whatToDo:['Open a fresh mystery-fault work order.','Read symptoms and observe machine behavior.','Use virtual measurements and I/O to locate the fault.','Justify your repair, rerun and check behavior.'],
 observableResult:'Evidence explains failure; simulation confirms repair.',
 commonMistake:'Random replacements prove no diagnosis; the guide hides the solution.',
 practiceRoute:'/scenario/plc-sbx-find-fault',practiceLabel:'Open hidden-fault scenario',topicId:'diagnose'}
];
export const findGuideBuild=(id:string)=>GUIDE_BUILDS.find(x=>x.id===id);
