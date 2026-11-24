export type GuideGroup='start'|'workspace'|'tools'|'plc'|'projects'|'help';
export type GuideStep={title:string;body:string;lookFor?:string};
export type GuideTopic={id:string;group:GuideGroup;title:string;summary:string;minutes:number;keywords:readonly string[];steps:readonly GuideStep[];next?:string;appRoute?:string;appLabel?:string};
export const GUIDE_TOPICS:readonly GuideTopic[]=[
{id:'welcome',group:'start',title:'Meet your virtual factory',summary:'Understand the six actions you will use again and again.',minutes:5,keywords:['start','orientation','beginner','home','intro'],steps:[
{title:'Choose where you want to work',body:'Simulator is the engineering workspace; Steady Guide explains it; Learn & Practice offers lessons; Assessments evaluate work.',lookFor:'The four main navigation links in the top header.'},
{title:'Know the six actions',body:'Place, wire, program, run, observe and repair. Learn one action at a time; a PLC is optional.'},
{title:'Understand the limits',body:'Educational models only: not vendor firmware, calibrated equipment, certified safety systems or real commissioning.'},
{title:'Begin with something small',body:'Start with My first lamp: a 24 V supply, NO pushbutton and lamp. Leave advanced scenes for later.'}],next:'first-lamp',appRoute:'/sandbox',appLabel:'See the simulator'},
{id:'first-lamp',group:'start',title:'My first working lamp',summary:'Place a supply, pushbutton and lamp; wire them and see real circuit behaviour.',minutes:12,keywords:['24v','lamp','light','pushbutton','starter','first circuit'],steps:[
{title:'Protect your existing work',body:'Export or back up your project before starting blank. The guide never clears it automatically.',lookFor:'Project menu → Download project JSON or Project library.'},
{title:'Place three devices',body:'Pause the empty project. Search for 24V supply, START NO and Lamp; place one of each.',lookFor:'Component library and its family/search filters.'},
{title:'Open logical wiring',body:'Select Logical and Wire (T). Connect named terminals, not device outlines.',lookFor:'Logical · Physical 3D · Floor Plan view tabs.'},
{title:'Make the supply-to-lamp loop',body:'Connect P24 → START A, START B → lamp L+, and lamp M- → M0. Virtual 24 V only.',lookFor:'Terminal labels on each of the three components.'},
{title:'Run and observe',body:'Run and press START. If the lamp stays dark, pause and check each terminal and live electrical state.',lookFor:'Run / Pause and the lamp indicator.'},
{title:'Save the working circuit',body:'Save in Project library and export JSON. Browser storage is not a permanent backup.'}],next:'save-your-work',appRoute:'/sandbox',appLabel:'Open the simulator (does not clear your project)'},
{id:'workbench',group:'workspace',title:'Find your way around the workbench',summary:'Recognize the library, three views, Inspector, programming dock and camera controls.',minutes:8,keywords:['view','workspace','camera','panel','inspector','toolbar','physical','logical','floor'],steps:[
{title:'Choose the right canvas',body:'Physical = interactive 3D; Logical = wiring; Floor Plan = 2D layout. All share one project.'},
{title:'Find and select equipment',body:'Search the library, select a device and read its properties and limits in Inspector.'},
{title:'Choose your tool',body:'Select (V), Wire (T), Measure (I). The active tool appears by the view controls.'},
{title:'Control the scene',body:'Use Orbit, Fly, First Person, Fit all or Focus selected in Physical. Camera moves never edit the project.'},
{title:'Open the engineering dock',body:'Open PLC programming and diagnostics with panel toggles or Tools. Pause before destructive edits.'}],next:'wire-safely',appRoute:'/sandbox',appLabel:'Find these controls in the workbench'},
{id:'wire-safely',group:'tools',title:'Wires, power, I/O and the meter',summary:'Connect named terminals instead of guessing which devices should work.',minutes:10,keywords:['terminal','P24','M0','I0.0','Q0.0','wire','measure','multimeter','sensor'],steps:[
{title:'Read the terminal names',body:'Supply: P24 positive 24 V, M0 return. PLC: L+/M power, I inputs, Q outputs.'},
{title:'Know signal direction',body:'Sensors feed inputs; PLC logic commands outputs; powered actuators respond according to wiring and model.'},
{title:'Use the proper view',body:'Use Logical/Wire with exact terminal names. Nearby machines are not automatically connected.'},
{title:'Measure the result',body:'Check virtual meter, live I/O and diagnostics. A wire alone proves neither power nor correct logic.'},
{title:'Remember the model limits',body:'Virtual 400 V three-phase and 24 V control wiring are separate. Never copy teaching circuits into real installations.'}],next:'plc-basics',appRoute:'/sandbox',appLabel:'Open wiring and instruments'},
{id:'plc-basics',group:'plc',title:'Understand your first PLC program',summary:'Learn inputs, outputs, scan timing and the Ladder/Structured Text/FBD choices.',minutes:12,keywords:['plc','ladder','structured text','fbd','scan','timer','counter'],steps:[
{title:'Start with the inputs',body:'PLC scans sample wired, powered inputs. Map a sensor or button to e.g. I0.0.'},
{title:'Write the controlling logic',body:'Ladder uses contacts/coils; ST uses text; FBD connects function blocks. Use the supported subset.'},
{title:'Associate outputs with loads',body:'Wire Q0.0 or another output to the load through the electrical model. Code cannot bypass wiring.'},
{title:'Run one deterministic scan',body:'Fixed 50 ms scan: sample inputs, execute logic, update outputs. Run repeats; Step advances one.'},
{title:'Read the evidence',body:'Check live I/O, watch/trace, diagnostics and plant response. Wrong logic must not produce preset success.'}],next:'language-tools',appRoute:'/sandbox',appLabel:'Go to the programming dock'},
{id:'language-tools',group:'plc',title:'Ladder, ST, FBD and PID',summary:'Choose a language and understand the simulator’s supported instructions.',minutes:10,keywords:['LD','ST','FBD','TON','CTU','CTD','PID','IEC','programming'],steps:[
{title:'Ladder',body:'Contacts, coils, branches, timers and counters; up to 32 rungs and 48 local tags per program.'},
{title:'Structured Text',body:'IF, CASE, bounded loops, typed variables, TON/TOF/TP, counters, edges and teaching PID.'},
{title:'Function Block Diagram',body:'Connect logic, timer, counter, comparator and output nodes. Not full IEC 61131-3.'},
{title:'Understand PID limits',body:'Teaching PID: clamped output, conditional anti-windup, 50 ms scan. No auto/manual, derivative filter, vendor tuning or dedicated 3D PID lesson yet.'},
{title:'When code fails',body:'Read compiler errors and check declarations and I/O mapping. A disconnected load cannot move.'}],next:'factory-scenes',appRoute:'/sandbox',appLabel:'Open the PLC editor'},
{id:'factory-scenes',group:'workspace',title:'Your first factory scene',summary:'Find original factory arrangements and understand the wiring/logic work still required.',minutes:9,keywords:['scene','factory','gallery','sorting','conveyor','robot','material'],steps:[
{title:'Browse the scene gallery',body:'Choose Foundation before Intermediate or Advanced in the scene library. The atlas covers all 21 original scenes.'},
{title:'Inspect the devices',body:'A sorting scene can contain a feeder, conveyor, geometry photoeye and diverter. Inspect terminals and limits.'},
{title:'Connect the I/O',body:'Arrangement is not a wired machine. Connect exact PLC input and output terminals.'},
{title:'Program and test',body:'Run your logic and observe plant response. Wrong code or disconnected sensors should fail.'}],next:'diagnose',appRoute:'/sandbox',appLabel:'Open the scene gallery'},
{id:'diagnose',group:'help',title:'Find out why something is not working',summary:'Use live I/O, measurement, alarms and a safe troubleshooting process.',minutes:10,keywords:['fault','diagnostics','stuck','error','no motion','no power','probe'],steps:[
{title:'Pause before editing',body:'Pause before rewiring, replacing parts or moving devices. Running locks destructive edits.'},
{title:'Look for the first missing condition',body:'Check supply → PLC power → input → logic → output voltage → wiring → actuator.'},
{title:'Measure rather than guess',body:'Read live I/O, virtual meter and diagnostics. An alarm is a symptom, not necessarily the cause.'},
{title:'Repair and re-run',body:'Change one suspected issue and retest. No hidden faults or graded solutions are disclosed.'}],next:'save-your-work',appRoute:'/sandbox',appLabel:'Open diagnostics'},
{id:'save-your-work',group:'projects',title:'Save, back up and restore projects',summary:'Keep your experiments recoverable and understand local-browser storage limits.',minutes:7,keywords:['save','backup','export','restore','project library','conflict','indexeddb','offline'],steps:[
{title:'Understand where data lives',body:'Working copy and library live in this browser, not an online account. Clearing site data can remove them.'},
{title:'Use Project library',body:'Project → Project library: name projects, save versions and restore revisions.'},
{title:'Download a separate backup',body:'Back up all or export project JSON before major experiments. Keep a copy outside the browser.'},
{title:'Handle a two-tab conflict',body:'Do not force an overwrite. Read the conflict dialog; export your copy or save it separately.'},
{title:'Know the offline limitation',body:'Cached resources support offline use. Storage limits, quota errors and crashes can still lose unsaved work.'}],next:'welcome',appRoute:'/sandbox',appLabel:'Open Project menu'},
{id:'learn-vs-assess',group:'start',title:'Guidance, lessons and assessments',summary:'Know when to use Steady Guide, Learn & Practice, or an assessment.',minutes:4,keywords:['learn','assessment','lesson','exam','practice','instructor'],steps:[
{title:'Steady Guide teaches navigation',body:'Learn devices, controls and how to start a task. Reading does not pass assignments.'},
{title:'Learn & Practice teaches a skill',body:'Guided lessons, ranked exercises, scenarios and labs use the simulator and evaluate outcomes.'},
{title:'Assessments measure outcomes',body:'Grading checks the actual project. The guide offers controls, not hidden faults, grading secrets or solutions.'}],next:'welcome',appRoute:'/learn',appLabel:'Open Learn & Practice'}
];
export const GUIDE_GROUPS:readonly {id:GuideGroup;title:string;description:string}[]=[
{id:'start',title:'Start here',description:'Understand the app and build your first circuit'},
{id:'workspace',title:'Navigate & explore',description:'Find panels, views and factory scenes'},
{id:'tools',title:'Wiring & instruments',description:'Learn terminal-level connections and measurements'},
{id:'plc',title:'PLC programming',description:'Choose LD, ST or FBD and debug your logic'},
{id:'projects',title:'Save & recover',description:'Protect projects, exports and browser data'},
{id:'help',title:'Troubleshooting',description:'Follow signals and investigate problems'}];
export const getGuideTopic=(id:string)=>GUIDE_TOPICS.find(t=>t.id===id);
export const guideTopicRoute=(id:string)=>'/guide/topic/'+encodeURIComponent(id);
export const searchGuideTopics=(query:string)=>{const q=query.trim().toLowerCase().slice(0,80);return q?GUIDE_TOPICS.filter(t=>[t.title,t.summary,t.id,...t.keywords].join(' ').toLowerCase().includes(q)):GUIDE_TOPICS;};
