import {FIRST_LAMP_WIRES} from './guide-first-lamp';
import {guideEquipmentName} from './guide-reference';

/** Read-only connection checklist. No simulator actions or automatic completion. */
export function GuideFirstLampConnections(){
 return <section className="sg-lamp-checklist" data-steady-first-lamp>
  <h3>Three virtual wires to connect</h3>
  <p>In a new paused project, place the supply, START button and lamp. In Logical / Wiring, select each first terminal then its destination.</p>
  <ol>{FIRST_LAMP_WIRES.map(({from,to},i)=><li key={i}
    data-steady-first-lamp-wire={i+1}
    data-from-kind={from.kind} data-from-terminal={from.terminal}
    data-to-kind={to.kind} data-to-terminal={to.terminal}>
   <strong>{guideEquipmentName(from.kind)} · {from.terminal}</strong>
   <span aria-hidden="true">→</span>
   <strong>{guideEquipmentName(to.kind)} · {to.terminal}</strong>
  </li>)}</ol>
  <p className="sg-muted">Virtual 24 V teaching model only, not real electrical or safety instructions.</p>
 </section>;
}
