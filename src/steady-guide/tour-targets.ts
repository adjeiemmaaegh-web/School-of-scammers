/** Visual, no-command spotlight locations. Selectors use actual SandboxPage DOM and are tested in Chromium. */
export type GuideTarget={
 id:'library'|'views'|'tools'|'canvas'|'inspector'|'dock'|'simulation'|'menus';
 title:string;description:string;selector:string;fallback?:string;hint:string;
};
export const GUIDE_TARGETS:readonly GuideTarget[]=[
{id:'library',title:'Component library',description:'Search for a virtual device and read its label. Placement is a separate action.',selector:'[data-p5-library]',fallback:'.p5-panel-toggles button:nth-child(1)',hint:'If the library is hidden, use the Library button in the View tools bar.'},
{id:'views',title:'Three workbench views',description:'Logical wiring, Physical 3D and 2D Floor Plan are views of the same project.',selector:'.p5-view-tabs',hint:'Switching a view does not replace the project.'},
{id:'tools',title:'Select, Wire and Measure',description:'Choose the active action before clicking. Keyboard shortcuts are V, T and I.',selector:'.p5-tool-actions',hint:'Pause first if a tool is disabled while the simulation runs.'},
{id:'canvas',title:'Your design area',description:'This shows the physical factory or the logical/floor-plan canvas.',selector:'[data-p5-view-active]',hint:'The visible canvas changes with the selected view; placing equipment does not wire it.'},
{id:'inspector',title:'Equipment inspector',description:'Select a device to inspect its available terminals, model settings and status.',selector:'[data-p5-inspector]',fallback:'.p5-panel-toggles button:nth-child(2)',hint:'If closed, choose Inspector in the View tools bar.'},
{id:'dock',title:'Programming and diagnostics',description:'The engineering dock holds the PLC program and virtual measurement tools.',selector:'[data-p5-dock]',fallback:'.p5-panel-toggles button:nth-child(3)',hint:'Select the PLC program or Measurements tabs; use Expand dock if collapsed.'},
{id:'simulation',title:'Run, Pause and Step',description:'Run starts the actual simulated PLC cycles; Pause permits project editing.',selector:'.efo-canvas-actions',fallback:'.sandbox-toolbar',hint:'The current simulation state and scan time appear below the workspace.'},
{id:'menus',title:'Project and Help menus',description:'Export/save projects before making a new blank project; Help opens this guide.',selector:'[data-p5-menu]',hint:'Steady Guide does not automatically open project files or overwrite work.'},
] as const;
export const guideTarget=(id:string)=>GUIDE_TARGETS.find(t=>t.id===id);
export function safeGuideSelector(id:string):string|null{return guideTarget(id)?.selector??null;}
