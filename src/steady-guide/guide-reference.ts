/** Reconciled with the University Recovery component-kind registry on 2026-11-26.
 * Each item is searchable without pulling the simulation engine into the Guide landing chunk.
 * Guarded by tests/steady-guide-reference.test.ts against both authoritative registries.
 */
import { SCENE_METADATA } from '../plant/scenes/metadata';
export const GUIDE_EQUIPMENT_KINDS=[
  "supply",
  "plc",
  "plc16",
  "start",
  "stop",
  "contactor",
  "motor",
  "conveyor",
  "photoeye",
  "diverter",
  "tank",
  "pump",
  "levelprobe",
  "drainvalve",
  "breaker",
  "overload",
  "lamp",
  "relay",
  "timerelay",
  "cylinder",
  "stacklight",
  "estop",
  "reversebutton",
  "forwardcontactor",
  "reversecontactor",
  "revmotor",
  "belt-conveyor",
  "roller-conveyor",
  "turntable",
  "stopper",
  "pusher",
  "diverter-gate",
  "box-feeder",
  "geometry-photoeye",
  "inductive-prox",
  "capacitive-prox",
  "light-curtain",
  "weigh-cell",
  "lift",
  "scissor-lift",
  "rotary-actuator",
  "pick-and-place",
  "palletizer",
  "shelf",
  "asrs-crane",
  "robot-arm",
  "process-tank",
  "mixer",
  "heater",
  "proportional-valve",
  "filler",
  "capper",
  "three-phase-supply",
  "star-delta-drive",
  "selector",
  "buzzer",
  "siren",
  "collector",
  "retro-photoeye",
  "laser-distance",
  "rfid-reader",
  "vision-sensor",
  "incremental-encoder",
  "compressor",
  "air-regulator",
  "safety-fence",
  "guard-door",
  "curved-conveyor",
  "transfer-unit",
  "process-station",
  "handrail",
  "platform",
  "stairs",
  "work-zone",
  "potentiometer",
  "selector-3pos",
  "seven-segment",
  "numeric-display",
  "operator-station",
  "indicator-panel",
  "io-di8",
  "io-do8",
  "io-ai4",
  "io-ao2",
  "transfer-pump",
  "merge-gate",
  "pressure-sensor",
  "gantry",
  "index-table",
  "machine-guard",
  "drive",
  "transfer-valve"
] as const;
export const GUIDE_SCENES=[
  {
    "id": "sorting-line",
    "title": "Photoeye and diverting line",
    "description": "Conveyor with geometry sensors and a reject gate"
  },
  {
    "id": "gate-accumulation",
    "title": "Stopper accumulation",
    "description": "Belt, blocker and trailing body queue"
  },
  {
    "id": "weigh-reject",
    "title": "Weigh and pusher reject",
    "description": "Mass threshold drives a real pusher"
  },
  {
    "id": "two-level-lift",
    "title": "Two-level lift transfer",
    "description": "Transport between two fixed elevations"
  },
  {
    "id": "gantry-transfer",
    "title": "Gantry pick and place",
    "description": "Feeder, two-axis gripper and outbound belt"
  },
  {
    "id": "palletizing",
    "title": "Layer palletizing",
    "description": "Stack pattern, count and completion feedback"
  },
  {
    "id": "mini-warehouse",
    "title": "3x5 mini warehouse",
    "description": "Rack, crane and inbound/outbound conveyors"
  },
  {
    "id": "robot-sort",
    "title": "Robot sort and place",
    "description": "Arm, sensors and two receiving areas"
  },
  {
    "id": "mixing-tank",
    "title": "Temperature and level mixing",
    "description": "Vessel, mixer, heater, proportional valve"
  },
  {
    "id": "bottle-line",
    "title": "Bottle filling and capping",
    "description": "Counter, stopper, timed filler and capper"
  },
  {
    "id": "material-inspection",
    "title": "Metal and nonmetal quality lane",
    "description": "Compare inductive and capacitive inspection before a worker-controlled diverter"
  },
  {
    "id": "height-guard",
    "title": "Height-sorted carton gate",
    "description": "Light curtain height threshold, stopper and alternate pusher response"
  },
  {
    "id": "three-way-handoff",
    "title": "Three-direction roller transfer",
    "description": "Two straight roller approaches, indexed turntable and side exit"
  },
  {
    "id": "reversible-roller-lane",
    "title": "Bidirectional accumulation lane",
    "description": "Reversing roller conveyor with a stopper and position feedback"
  },
  {
    "id": "parallel-sort-cells",
    "title": "Parallel material inspection cells",
    "description": "Two independent feeders, carrier lanes and material sensors"
  },
  {
    "id": "scissor-lift-station",
    "title": "Scissor platform dispatch",
    "description": "Two-level material handling with a moving scissor lift and source/destination rollers"
  },
  {
    "id": "rotary-inspection",
    "title": "Rotary fixture inspection",
    "description": "Indexing actuator, sensor and physical part presentation"
  },
  {
    "id": "guarded-conveyor",
    "title": "Light-curtain stop station",
    "description": "Optical obstruction and stopper-based educational control interlock"
  },
  {
    "id": "temperature-batch",
    "title": "Temperature-controlled batch",
    "description": "Tank level, heating, agitator and commanded proportional outlet"
  },
  {
    "id": "flow-valve-diagnostics",
    "title": "Valve motion and vessel control",
    "description": "Analog outlet position feedback with a process tank and heater"
  },
  {
    "id": "robot-warehouse-receiving",
    "title": "Warehouse intake and retrieval",
    "description": "Roller intake, shelf storage, crane and downstream robot handoff"
  }
] as const;
export const GUIDE_SCENE_META=SCENE_METADATA;
export type GuideSceneId=(typeof GUIDE_SCENES)[number]['id'];
export const findGuideScene=(id:string)=>GUIDE_SCENES.find(scene=>scene.id===id);
export const GUIDE_GLOSSARY=[
{term:'PLC',meaning:'Programmable logic controller; reads wired input conditions and updates commanded outputs each scan.'},
{term:'Scan',meaning:'A deterministic PLC evaluation cycle; the training simulator defaults to 50 ms and supports selectable scan periods.'},
{term:'P24',meaning:'The positive 24 V terminal of a virtual DC supply.'},
{term:'M0',meaning:'The return terminal of a virtual 24 V supply.'},
{term:'L+ / M',meaning:'Power and return terminals on a virtual PLC or powered sensor.'},
{term:'I0.0',meaning:'An example discrete PLC input address.'},
{term:'Q0.0',meaning:'An example PLC output address; an output needs correct wiring and electrical power to drive a load.'},
{term:'Terminal',meaning:'A named electrical or signal connection point on a simulated device.'},
{term:'Wire / net',meaning:'A connection between named terminals; the simulator computes its electrical consequences.'},
{term:'Contact',meaning:'A switching element. NO closes on activation; NC opens on activation.'},
{term:'Coil',meaning:'An energized control element, such as a relay or contactor coil.'},
{term:'Photoeye',meaning:'An optical detection device that may provide a PLC input according to the modelled scene and power conditions.'},
{term:'Actuator',meaning:'A device that changes simulated physical state when correctly commanded and powered.'},
{term:'Inspector',meaning:'The workbench panel showing a selected device’s properties, terminals and model limits.'},
{term:'Ladder / LD',meaning:'A relay-style graphical PLC programming language.'},
{term:'Structured Text / ST',meaning:'A typed textual programming language with a bounded IEC-inspired subset in this application.'},
{term:'FBD',meaning:'Function Block Diagram: connect supported function nodes to form PLC logic.'},
{term:'PID',meaning:'A proportional-integral-derivative control calculation; here a simplified teaching function block.'},
{term:'Hidden fault',meaning:'A trainer-injected fault that should be discovered through symptoms and measurement, not disclosed by the guide.'},
{term:'IndexedDB',meaning:'Local browser database used for the named project library and its revisions.'},
{term:'Offline',meaning:'After caching, the app can run without a network connection; clearing browser site data may still remove projects.'},
] as const;

/** Lightweight, reviewed beginner vocabulary without importing the simulation engine. */
export const GUIDE_EQUIPMENT_NAMES:Partial<Record<(typeof GUIDE_EQUIPMENT_KINDS)[number],string>>={
 supply:'24V supply',plc:'Virtual PLC',plc16:'Virtual PLC 16/16',
 start:'START NO pushbutton',stop:'STOP NC pushbutton',lamp:'24V pilot lamp',
 photoeye:'Mark photoeye','geometry-photoeye':'Geometry photoeye',
 'inductive-prox':'Inductive proximity sensor','capacitive-prox':'Capacitive proximity sensor',
 estop:'Training E-stop','three-phase-supply':'Virtual 400V three-phase source',
 timerelay:'On-delay timer relay',stacklight:'Stack light (R/Y/G)',
 'light-curtain':'Light curtain','star-delta-drive':'Star/delta motor drive',
};
export function guideEquipmentName(kind:(typeof GUIDE_EQUIPMENT_KINDS)[number]):string {
 return GUIDE_EQUIPMENT_NAMES[kind]??kind.replaceAll('-',' ');
}
export function searchGuideEquipment(query:string):(typeof GUIDE_EQUIPMENT_KINDS)[number][]{
 const term=query.trim().toLowerCase().slice(0,80);
 if(!term)return [];
 return GUIDE_EQUIPMENT_KINDS.filter(kind=>
  [kind,kind.replaceAll('-',' '),guideEquipmentName(kind)].some(s=>s.toLowerCase().includes(term)));
}
