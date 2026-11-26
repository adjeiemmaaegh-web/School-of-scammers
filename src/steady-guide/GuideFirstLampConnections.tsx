import {FIRST_LAMP_WIRES} from './guide-first-lamp';
import {guideEquipmentName} from './guide-reference';

/** Read-only virtual 24 V terminal list. */
export function GuideFirstLampConnections(){
 return <section className="sg-lamp-checklist" data-steady-first-lamp>
  <h3>Three virtual wires</h3>
  <ol>{FIRST_LAMP_WIRES.map(({from,to},i)=><li key={i}
   data-steady-first-lamp-wire={i+1}
   data-from-kind={from.kind} data-from-terminal={from.terminal}
   data-to-kind={to.kind} data-to-terminal={to.terminal}>
   {guideEquipmentName(from.kind)} · {from.terminal} → {guideEquipmentName(to.kind)} · {to.terminal}
  </li>)}</ol>
  <p>Virtual 24 V teaching model only—not physical wiring instructions.</p>
 </section>;
}
