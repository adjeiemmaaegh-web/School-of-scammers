/** Open logical schematic of the same project as the 3D plant.
 * Draws real project wires and offers actual terminal command dispatch.
 * No electrical simulation is performed in this component.
 */
import {COMPONENTS} from '../../components/registry';
import type {ProjectFile,RenderSnapshot} from '../../sim/signals';
import {perDeviceLive} from '../../sim/device-state';
import {LOGICAL_WORLD_HEIGHT,LOGICAL_WORLD_WIDTH,logicalWirePaths,nodeHeightOf,portsOf} from './logical-wiring';
type Props={
  project:ProjectFile|null;snapshot:RenderSnapshot|null;editable:boolean;
  selectedTerminal:string|null;selectedDeviceId:string|null;
  onTerminal:(id:string)=>void;onSelectDevice:(id:string)=>void;
};
export function LogicalWiringCanvas({project,snapshot,editable,selectedTerminal,selectedDeviceId,
  onTerminal,onSelectDevice}:Props){
  const parts=project?.components??[];
  const wires=logicalWirePaths(parts,project?.wires??[]);
  const height=Math.max(LOGICAL_WORLD_HEIGHT,...parts.map(c=>c.y+nodeHeightOf(c)+16));
  return <section className="p5-logical-board" aria-label="Logical device and terminal wiring schematic"
    data-p5-logical-canvas>
    <div className="p5-logical-scroll" tabIndex={0} aria-label="Scrollable logical wiring surface">
      <div className="p5-logical-canvas" style={{height}}>
        <svg className="p5-logical-wires" viewBox={`0 0 ${LOGICAL_WORLD_WIDTH} ${height}`}
          width={LOGICAL_WORLD_WIDTH} height={height} aria-label="Project wire routes">
          {wires.map(w=><path data-p5-wire={w.id} key={w.id} d={w.path}>
            <title>{w.from} to {w.to}</title>
          </path>)}
        </svg>
        {parts.map(c=>{
          const def=COMPONENTS[c.kind];
          const live=snapshot?perDeviceLive(snapshot,c):undefined;
          const ports=portsOf(c);
          return <div className={`p5-logical-node ${selectedDeviceId===c.id?'is-selected':''}`}
            key={c.id} data-p5-logical-device={c.id}
            style={{left:c.x,top:c.y,minHeight:nodeHeightOf(c)}}>
            <button type="button" className="p5-logical-device-title"
              aria-pressed={selectedDeviceId===c.id}
              onClick={()=>onSelectDevice(c.id)}>{def.label}</button>
            <code>{c.id}</code>
            <span className="p5-logical-state">{live===undefined?'Simulated device':live?'ON':'OFF'}</span>
            {ports.map(p=>{
              const terminal=`${c.id}.${p.name}`;
              return <button type="button" key={terminal} data-p5-pin={terminal}
                className={`p5-logical-terminal ${p.side} ${selectedTerminal===terminal?'is-selected':''}`}
                style={{top:p.y-c.y-7}} disabled={!editable}
                title={terminal} aria-label={`Connect ${terminal}`}
                aria-pressed={selectedTerminal===terminal}
                onClick={()=>onTerminal(terminal)}>{p.name}</button>;
            })}
          </div>;
        })}
        {!parts.length&&<div className="p5-logical-empty">
          <strong>No devices placed yet</strong>
          <span>Choose an implemented PLC, sensor or actuator in the library to start your diagram.</span>
        </div>}
      </div>
    </div>
    <p className="sandbox-help">Illustrative logical layout. Project connections and PLC signals are
      calculated by the real worker; the routes here are not proof of energization.
      Select a device to inspect it, or select two terminals to request a real validated wire.</p>
  </section>;
}
