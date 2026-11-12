/** P9 original industrial workcell learning paths.
 * These are internally authored scenario descriptions, not copied vendor
 * scenes, exercises, diagrams, or proprietary training media.
 */
export const SCENE_CATEGORIES=[
 'Conveyors & sorting','Material handling','Robotics & storage',
 'Process & fluids','Safety & inspection',
] as const;
export type SceneCategory=typeof SCENE_CATEGORIES[number];
export type SceneDifficulty='Foundation'|'Intermediate'|'Advanced';
export type SceneTeachingMetadata={
 category:SceneCategory;
 difficulty:SceneDifficulty;
 skills:readonly [string,string,...string[]];
};
export const SCENE_METADATA:Readonly<Record<string,SceneTeachingMetadata>>={
 'sorting-line':{category:'Conveyors & sorting',difficulty:'Foundation',
  skills:['Photoeye wiring','PLC-controlled diverting']},
 'gate-accumulation':{category:'Conveyors & sorting',difficulty:'Intermediate',
  skills:['Queue sensing','Stopper sequence']},
 'weigh-reject':{category:'Conveyors & sorting',difficulty:'Intermediate',
  skills:['Numeric weight','Pneumatic reject']},
 'two-level-lift':{category:'Material handling',difficulty:'Intermediate',
  skills:['Travel limits','Lift interlock']},
 'gantry-transfer':{category:'Material handling',difficulty:'Advanced',
  skills:['Pick timing','Position feedback']},
 'palletizing':{category:'Robotics & storage',difficulty:'Advanced',
  skills:['Pattern completion','Material conservation']},
 'mini-warehouse':{category:'Robotics & storage',difficulty:'Advanced',
  skills:['Storage occupancy','Crane commands']},
 'robot-sort':{category:'Robotics & storage',difficulty:'Advanced',
  skills:['Inductive sensing','Robot grip conditions']},
 'mixing-tank':{category:'Process & fluids',difficulty:'Intermediate',
  skills:['Analog level','Temperature conditions']},
 'bottle-line':{category:'Process & fluids',difficulty:'Advanced',
  skills:['Dwell timing','Sequential filling']},
 'material-inspection':{category:'Safety & inspection',difficulty:'Intermediate',
  skills:['Inductive classification','Capacitive comparison']},
 'height-guard':{category:'Safety & inspection',difficulty:'Intermediate',
  skills:['Light curtain','Height threshold']},
 'three-way-handoff':{category:'Material handling',difficulty:'Advanced',
  skills:['Turntable index','Multi-conveyor transfer']},
 'reversible-roller-lane':{category:'Conveyors & sorting',difficulty:'Intermediate',
  skills:['Motor reverse','Accumulation']},
 'parallel-sort-cells':{category:'Conveyors & sorting',difficulty:'Advanced',
  skills:['Isolated lanes','Independent controller logic']},
 'scissor-lift-station':{category:'Material handling',difficulty:'Intermediate',
  skills:['Scissor lift travel','Top/bottom limits']},
 'rotary-inspection':{category:'Material handling',difficulty:'Intermediate',
  skills:['Actuator indexing','Part-ready interlock']},
 'guarded-conveyor':{category:'Safety & inspection',difficulty:'Foundation',
  skills:['Optical obstruction','Stopper logic']},
 'temperature-batch':{category:'Process & fluids',difficulty:'Intermediate',
  skills:['Analog temperature','Batch level']},
 'flow-valve-diagnostics':{category:'Process & fluids',difficulty:'Advanced',
  skills:['Numeric valve travel','Fault diagnosis']},
 'robot-warehouse-receiving':{category:'Robotics & storage',difficulty:'Advanced',
  skills:['Rack/crane management','Robot handoff']},
} as const;

/** Search labels and canonical IDs only; deterministic, locale-independent,
 * no broad regex or arbitrary user-provided code passed to the worker.
 */
export function searchSceneIds(
 text:string,category:SceneCategory|'All',scenes:readonly {
  id:string;title:string;description:string;
 }[],
):string[]{
 const q=text.trim().toLocaleLowerCase('en').slice(0,80);
 return scenes.filter(scene=>{
  const meta=SCENE_METADATA[scene.id];
  if(!meta||category!=='All'&&category!==meta.category)return false;
  if(!q)return true;
  const haystack=[scene.title,scene.description,scene.id,...meta.skills]
   .join(' ').toLocaleLowerCase('en');
  return haystack.includes(q);
 }).map(scene=>scene.id);
}
