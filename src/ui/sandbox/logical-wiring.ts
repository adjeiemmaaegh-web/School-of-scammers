/** P5-UX logical presentation geometry for existing validated project terminals.
 * Coordinates are diagram-only and do not change electrical connectivity.
 */
import {COMPONENTS} from '../../components/registry';
import type {PlacedComponent,Wire} from '../../sim/signals';
export type LogicalPort={name:string;side:'left'|'right';x:number;y:number};
export type LogicalLink={id:string;from:string;to:string;path:string};
export const LOGICAL_NODE_WIDTH=170;
export const LOGICAL_WORLD_WIDTH=1080;
export const LOGICAL_WORLD_HEIGHT=580;
export function portsOf(component:PlacedComponent):LogicalPort[]{
  const terminals=COMPONENTS[component.kind].terminals;
  const previous:{left:number;right:number}={left:-4,right:-4};
  return terminals.map(t=>{
    const y=Math.max(t.y,previous[t.side]+20);
    previous[t.side]=y;
    return {name:t.name,side:t.side,x:component.x+(t.side==='left'?0:LOGICAL_NODE_WIDTH),
      y:component.y+y};
  });
}
export function nodeHeightOf(component:PlacedComponent):number{
  const ports=portsOf(component);
  return Math.max(130,...ports.map(p=>p.y-component.y+22));
}
export function endpointOf(identifier:string,components:readonly PlacedComponent[]):
  {x:number;y:number}|null{
  const dot=identifier.indexOf('.');
  if(dot<=0)return null;
  const device=components.find(c=>c.id===identifier.slice(0,dot));
  return device ? portsOf(device).find(p=>p.name===identifier.slice(dot+1))??null : null;
}
export function logicalWirePaths(components:readonly PlacedComponent[],
  wires:readonly Wire[]):LogicalLink[]{
  const links:LogicalLink[]=[];
  for(const wire of wires){
    const a=endpointOf(wire.from,components),b=endpointOf(wire.to,components);
    if(!a||!b)continue; // The authoritative project validator owns invalid wire errors.
    const midpoint=Math.round((a.x+b.x)/2);
    links.push({id:wire.id,from:wire.from,to:wire.to,
      path:`M ${a.x} ${a.y} L ${midpoint} ${a.y} L ${midpoint} ${b.y} L ${b.x} ${b.y}`});
  }
  return links;
}
