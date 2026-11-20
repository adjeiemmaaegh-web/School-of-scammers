import type {ComponentKind} from '../components/registry';
export type GuideBuild={
 id:string;title:string;goal:string;level:'Foundation'|'Intermediate';
 minutes:number;devices:readonly ComponentKind[];optional?:readonly ComponentKind[];
 whatToDo:readonly string[];observableResult:string;commonMistake:string;
 practiceRoute:string;practiceLabel:string;sceneId?:string;topicId:string;
}
/** Task-based equipment selection, NOT a pre-wired project or assessment answer key. */
export const GUIDE_BUILDS:readonly GuideBuild[]=[
{id:'first-lamp',title:'Light a virtual 24 V lamp',goal:'Understand one complete circuit before adding a PLC.',level:'Foundation',minutes:12,
 devices:['supply','start','lamp'],
 whatToDo:['Save or export your existing project before starting blank.','Place the supply, normally-open START button and pilot lamp.','Switch to Logical/Wire. Connect P24 → START A, START B → lamp L+, and lamp M- → supply M0.','Run the simulation, press and release START, then inspect the lamp.'],
 observableResult:'The lamp lights only when the wired pushbutton is pressed and the virtual loop is complete.',
 commonMistake:'A nearby lamp is not electrically powered until its terminals form the correct closed path.',
 practiceRoute:'/sandbox',practiceLabel:'Open an empty or existing simulator',topicId:'first-lamp'},
{id:'motor-starter',title:'Run and stop a virtual motor',goal:'Introduce PLC inputs/outputs and a contactor-controlled motor.',level:'Foundation',minutes:25,
 devices:['supply','plc','start','stop','contactor','motor'],optional:['lamp','breaker','overload'],
 whatToDo:['Start from a named backup or the existing motor-starter lesson.','Inspect the PLC’s L+/M power, input terminals, output terminals and the contactor coil/contact.','Wire the correct terminal-level circuit using the lesson work order; choose a supported PLC program.','Run, then demonstrate both start and stop behavior while watching live I/O and contactor/motor state.'],
 observableResult:'The motor responds to actual PLC logic and complete wiring; STOP makes it stop.',
 commonMistake:'A program that sets Q0.0 cannot move the motor if the PLC is unpowered or the output/contactor circuit is incomplete.',
 practiceRoute:'/scenario/plc-sbx-startstop',practiceLabel:'Open motor starter guided scenario',topicId:'plc-basics'},
{id:'factory-sort',title:'Sort objects on a conveyor',goal:'Discover material handling, photoeyes and PLC-controlled diverters.',level:'Intermediate',minutes:30,
 devices:['box-feeder','belt-conveyor','geometry-photoeye','diverter-gate','plc16'],
 whatToDo:['Save your current project and browse the original Photoeye and diverting line scene.','Inspect the feeder, conveyor, photoeye and diverter one by one.','Map actual scene signals to the PLC and drive the correct actuator commands.','Run a few simulated objects and inspect both sensor readings and the actual sort behavior.'],
 observableResult:'The sensor detects modeled objects and a correctly commanded diverter changes their physical route.',
 commonMistake:'A scene arrangement is not automatically a wired or solved factory. Reference programs are not proof of real scan outcomes.',
 practiceRoute:'/sandbox',practiceLabel:'Open simulator scene gallery',sceneId:'sorting-line',topicId:'factory-scenes'},
{id:'tank-control',title:'Control the level in a tank',goal:'Learn a pump, level sensor, valve and digital PLC control.',level:'Intermediate',minutes:30,
 devices:['supply','plc','tank','pump','levelprobe','drainvalve'],
 whatToDo:['Start from the existing tank-level work order, not someone else’s saved project.','Identify the real high-level sensor and pump/valve terminal names.','Wire the PLC and power path, then implement the supported control behavior.','Watch the high-level input, outlet/inlet state and actual virtual liquid level across repeated scans.'],
 observableResult:'The modeled level rises and falls based on wiring, PLC logic and the active process state.',
 commonMistake:'A numeric tank display or a loaded reference program does not substitute for correctly powered pump and valve wiring.',
 practiceRoute:'/scenario/plc-sbx-tank',practiceLabel:'Open tank level scenario',topicId:'plc-basics'},
{id:'cylinder',title:'Move a pneumatic cylinder',goal:'Learn two solenoid commands and end-position limit switches.',level:'Intermediate',minutes:25,
 devices:['supply','plc','cylinder'],optional:['stacklight'],
 whatToDo:['Inspect the cylinder EXT+, RET+, M-, EXT_LS and RET_LS terminals.','Start with the focused pneumatics engineering lab, then try the sandbox device.','Wire PLC outputs to the intended solenoids and inputs to modeled end limits.','Run and observe which end limit is active; pause and diagnose a missing command.'],
 observableResult:'The cylinder changes its modeled position when its valid control path is present.',
 commonMistake:'The simplified cylinder assumes air is available. It is not a complete pneumatic design or a physical pressure test.',
 practiceRoute:'/labs/pneumatics',practiceLabel:'Open pneumatics lab',topicId:'wire-safely'},
{id:'diagnostic-mission',title:'Diagnose a stopped starter',goal:'Practice reading the virtual meter and following signals rather than guessing.',level:'Intermediate',minutes:25,
 devices:['supply','plc','contactor','motor'],optional:['start','stop','lamp'],
 whatToDo:['Open the existing mystery-fault scenario with a fresh work-order attempt.','Read its symptoms and observe what the machine actually does.','Use virtual measurements and input/output states to locate the broken stage.','Repair only what you can justify; run again and check the behavior.'],
 observableResult:'Your diagnostic evidence explains the failure and the actual simulator confirms the repair.',
 commonMistake:'Replacing random devices without measurement does not demonstrate an understood fault. Steady Guide intentionally hides the scenario solution.',
 practiceRoute:'/scenario/plc-sbx-find-fault',practiceLabel:'Open hidden-fault scenario',topicId:'diagnose'}
];
export const findGuideBuild=(id:string)=>GUIDE_BUILDS.find(x=>x.id===id);
