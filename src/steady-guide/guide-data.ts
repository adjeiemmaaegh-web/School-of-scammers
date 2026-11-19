export type GuideGroup='start'|'workspace'|'tools'|'plc'|'projects'|'help';
export type GuideStep={title:string;body:string;lookFor?:string};
export type GuideTopic={id:string;group:GuideGroup;title:string;summary:string;minutes:number;keywords:readonly string[];steps:readonly GuideStep[];next?:string;appRoute?:string;appLabel?:string};
export const GUIDE_TOPICS:readonly GuideTopic[]=[
{id:'welcome',group:'start',title:'Meet your virtual factory',summary:'Understand the six actions you will use again and again.',minutes:5,keywords:['start','orientation','beginner','home','intro'],steps:[
{title:'Choose where you want to work',body:'Simulator is an empty engineering workspace. Steady Guide explains where to click. Learn & Practice provides existing lessons and scenarios. Assessments are for evaluated work.',lookFor:'The four main navigation links in the top header.'},
{title:'Know the six actions',body:'Place equipment, wire terminals, program a PLC where needed, run the simulation, observe live feedback and repair problems. You can learn one action at a time.'},
{title:'Understand the limits',body:'This is a simplified educational simulator. It is not real vendor firmware, calibrated electrical equipment, a certified safety system or a replacement for real commissioning.'},
{title:'Begin with something small',body:'A single 24 V supply, a normally-open pushbutton and a lamp make a good first project. Start with My first lamp rather than an advanced factory scene.'}],next:'first-lamp',appRoute:'/sandbox',appLabel:'See the simulator'},
{id:'first-lamp',group:'start',title:'My first working lamp',summary:'Place a supply, pushbutton and lamp; wire them and see real circuit behaviour.',minutes:12,keywords:['24v','lamp','light','pushbutton','starter','first circuit'],steps:[
{title:'Protect your existing work',body:'If the simulator contains an existing project, export or back it up before making a new empty project. Steady Guide never clears a project automatically.',lookFor:'Project menu → Download project JSON or Project library.'},
{title:'Place three devices',body:'In a new, paused project, find 24V supply, START NO and Lamp in the component library. Place one of each.',lookFor:'Component library and its family/search filters.'},
{title:'Open logical wiring',body:'Select the Logical view and Wire tool (T). A wire connects one real named terminal to another.',lookFor:'Logical · Physical 3D · Floor Plan view tabs.'},
{title:'Make the supply-to-lamp loop',body:'Connect supply P24 to START A. Connect START B to the lamp L+ terminal. Connect lamp M- back to supply M0. These are illustrative virtual 24 V connections only.',lookFor:'Terminal labels on each of the three components.'},
{title:'Run and observe',body:'Press Run; operate the pushbutton. The lamp should respond when the circuit is complete. If nothing happens, pause and inspect every named terminal and the live electrical state.',lookFor:'Run / Pause and the lamp indicator.'},
{title:'Save the working circuit',body:'Save a named copy in Project library, and download a JSON backup. Your browser data is not a guaranteed permanent backup.'}],next:'save-your-work',appRoute:'/sandbox',appLabel:'Open the simulator (does not clear your project)'},
{id:'workbench',group:'workspace',title:'Find your way around the workbench',summary:'Recognize the library, three views, Inspector, programming dock and camera controls.',minutes:8,keywords:['view','workspace','camera','panel','inspector','toolbar','physical','logical','floor'],steps:[
{title:'Choose the right canvas',body:'Physical is the interactive 3D factory. Logical shows electrical terminals and wiring. Floor Plan is the 2D layout editor. They describe one shared project.'},
{title:'Find and select equipment',body:'Search the component library on the left, choose a device, then use the Inspector to examine its properties and supported model limits.'},
{title:'Choose your tool',body:'Select (V) chooses a device; Wire (T) connects named terminals in the relevant view; Measure (I) opens measurement-oriented work. The active tool is shown next to the view controls.'},
{title:'Control the scene',body:'Use Orbit, Fly or First Person, plus Fit all and Focus selected as available in Physical view. Camera movement does not move or rewire machines.'},
{title:'Open the engineering dock',body:'The dock contains PLC programming and diagnostics. If it is hidden, use the panel toggles or Tools menu. Running locks destructive editing; press Pause first.'}],next:'wire-safely',appRoute:'/sandbox',appLabel:'Find these controls in the workbench'},
{id:'wire-safely',group:'tools',title:'Wires, power, I/O and the meter',summary:'Connect named terminals instead of guessing which devices should work.',minutes:10,keywords:['terminal','P24','M0','I0.0','Q0.0','wire','measure','multimeter','sensor'],steps:[
{title:'Read the terminal names',body:'P24 is the virtual positive 24 V rail and M0 the return of a supply. PLC L+ and M power the controller. I terminals are inputs; Q terminals are outputs.'},
{title:'Know signal direction',body:'Sensors typically supply an input condition; PLC programs evaluate inputs and command output terminals; actuators respond only when the model and wiring conditions are satisfied.'},
{title:'Use the proper view',body:'Use Logical/Wire to join exact terminal identifiers. Do not assume that simply placing two machines near each other connects them.'},
{title:'Measure the result',body:'Use the virtual multimeter or live I/O/diagnostics to observe values. A connected wire alone does not guarantee a powered load or correct program.'},
{title:'Remember the model limits',body:'The virtual 400 V three-phase teaching domain is separate from 24 V control wiring. Do not copy these simplified circuits into real electrical installations.'}],next:'plc-basics',appRoute:'/sandbox',appLabel:'Open wiring and instruments'},
{id:'plc-basics',group:'plc',title:'Understand your first PLC program',summary:'Learn inputs, outputs, scan timing and the Ladder/Structured Text/FBD choices.',minutes:12,keywords:['plc','ladder','structured text','fbd','scan','timer','counter'],steps:[
{title:'Start with the inputs',body:'A PLC reads a sampled input image from connected, powered devices. Map a physical sensor or button to an input address such as I0.0.'},
{title:'Write the controlling logic',body:'Choose Ladder for contact-and-coil circuits, Structured Text for textual logic, or FBD for connected function blocks. Use only the supported educational subset.'},
{title:'Associate outputs with loads',body:'An output tag such as Q0.0 must reach a correctly connected actuator through the electrical model. Code cannot bypass a missing wire.'},
{title:'Run one deterministic scan',body:'The educational PLC cycle is fixed at 50 ms. Sample inputs, execute the program and update outputs. Run starts repeated scans; Step advances one.'},
{title:'Read the evidence',body:'Use live I/O, watch/trace, diagnostics and the actual plant. Incorrect logic should produce incorrect behaviour, not a pre-recorded success animation.'}],next:'language-tools',appRoute:'/sandbox',appLabel:'Go to the programming dock'},
{id:'language-tools',group:'plc',title:'Ladder, ST, FBD and PID',summary:'Choose a language and understand the simulator’s supported instructions.',minutes:10,keywords:['LD','ST','FBD','TON','CTU','CTD','PID','IEC','programming'],steps:[
{title:'Ladder',body:'Use contacts, coils, branches, timers and counters for relay-style logic. The educational editor supports up to 32 rungs and 48 local tags per program.'},
{title:'Structured Text',body:'Use IF, CASE, bounded loops, typed variables, TON/TOF/TP, counters, edge detectors and a teaching PID function block.'},
{title:'Function Block Diagram',body:'Connect supported logic, timer, counter, comparator and output nodes. It is a bounded subset, not complete IEC 61131-3.'},
{title:'Understand PID limits',body:'The teaching PID has a clamped output and conditional anti-windup with a fixed 50 ms scan. It has no auto/manual switch, derivative filter or vendor-specific tuning; it is not yet a dedicated 3D PID lesson.'},
{title:'When code fails',body:'Read compiler errors, check declared inputs/outputs, inspect I/O mapping and remember: a correct program with a disconnected output still cannot move real simulated equipment.'}],next:'factory-scenes',appRoute:'/sandbox',appLabel:'Open the PLC editor'},
{id:'factory-scenes',group:'workspace',title:'Your first factory scene',summary:'Find original factory arrangements and understand the wiring/logic work still required.',minutes:9,keywords:['scene','factory','gallery','sorting','conveyor','robot','material'],steps:[
{title:'Browse the scene gallery',body:'Inside the simulator, open the scene library and choose a Foundation scene before Intermediate or Advanced. The atlas explains all 21 original scenes.'},
{title:'Inspect the devices',body:'A sorting scene can include a feeder, conveyor, geometry photoeye and diverter. Select devices and read their terminals and model limits.'},
{title:'Connect the I/O',body:'An arrangement is not proof of a functioning, fully wired machine. Follow the real terminal names and connect PLC inputs and outputs.'},
{title:'Program and test',body:'Run your own logic and observe the authoritative plant response. A wrong PLC program or disconnected photoeye should cause the wrong result.'}],next:'diagnose',appRoute:'/sandbox',appLabel:'Open the scene gallery'},
{id:'diagnose',group:'help',title:'Find out why something is not working',summary:'Use live I/O, measurement, alarms and a safe troubleshooting process.',minutes:10,keywords:['fault','diagnostics','stuck','error','no motion','no power','probe'],steps:[
{title:'Pause before editing',body:'When running, the project locks destructive edits. Pause before rewiring, replacing parts or changing device placement.'},
{title:'Look for the first missing condition',body:'Verify the supply, PLC power, input state, program result, output voltage, terminal wiring and actuator condition—in that order.'},
{title:'Measure rather than guess',body:'Use live I/O, virtual meter probes and the diagnostics panel. A displayed alarm is a symptom, not necessarily the root cause.'},
{title:'Repair and re-run',body:'Change one suspected problem, run again and observe. In graded fault scenarios Steady Guide does not reveal the hidden fault or solution.'}],next:'save-your-work',appRoute:'/sandbox',appLabel:'Open diagnostics'},
{id:'save-your-work',group:'projects',title:'Save, back up and restore projects',summary:'Keep your experiments recoverable and understand local-browser storage limits.',minutes:7,keywords:['save','backup','export','restore','project library','conflict','indexeddb','offline'],steps:[
{title:'Understand where data lives',body:'The active working copy and project library are stored locally in this browser. They are not synced to an online account; clearing site data can remove them.'},
{title:'Use Project library',body:'Choose Project → Project library to name and manage projects, save versions and restore an earlier revision.'},
{title:'Download a separate backup',body:'Use Back up all or export individual project JSON files before major experiments. Keep a copy outside the browser.'},
{title:'Handle a two-tab conflict',body:'If another tab changed the same project, do not force an overwrite. Export your copy or keep it as another project; check the conflict dialog.'},
{title:'Know the offline limitation',body:'The app can run offline after its required resources are cached, but browser storage, quota failures and forced crashes can still threaten unsaved work.'}],next:'welcome',appRoute:'/sandbox',appLabel:'Open Project menu'},
{id:'learn-vs-assess',group:'start',title:'Guidance, lessons and assessments',summary:'Know when to use Steady Guide, Learn & Practice, or an assessment.',minutes:4,keywords:['learn','assessment','lesson','exam','practice','instructor'],steps:[
{title:'Steady Guide teaches navigation',body:'Use it to learn equipment functions, where tools live and how to begin a task. It never marks an assignment passed.'},
{title:'Learn & Practice teaches a skill',body:'Existing guided lessons, ranked exercises, scenarios and engineering labs run on the real simulator and evaluate outcomes.'},
{title:'Assessments measure outcomes',body:'A graded scenario checks the actual project. The guide gives generic controls, not hidden faults, grading secrets or complete solutions.'}],next:'welcome',appRoute:'/learn',appLabel:'Open Learn & Practice'}
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
