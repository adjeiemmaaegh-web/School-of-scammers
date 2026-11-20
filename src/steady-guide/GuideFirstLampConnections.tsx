import { FIRST_LAMP_WIRES, firstLampTerminalName } from './guide-first-lamp';

/** Read-only terminal checklist for the exact circuit verified by the real worker and Chromium. */
export function GuideFirstLampConnections(){
 return <section className="sg-lamp-checklist" data-steady-first-lamp>
   <h3>Check the three virtual wires</h3>
   <p>After placing one supply, one START NO button and one pilot lamp in a new paused project, join these exact terminals in Logical / Wiring. Select the first terminal, then the second.</p>
   <ol>{FIRST_LAMP_WIRES.map(({from,to},index)=><li key={index}
     data-steady-first-lamp-wire={index+1}
     data-from-kind={from.kind} data-from-terminal={from.terminal}
     data-to-kind={to.kind} data-to-terminal={to.terminal}>
      <span>{index+1}</span>
      <div><strong>{firstLampTerminalName(from)}</strong>
       <span aria-hidden="true">→</span>
       <strong>{firstLampTerminalName(to)}</strong>
      </div>
     </li>)}</ol>
   <p className="sg-muted">These connections apply only to the virtual 24 V teaching model. They do not establish a real-world electrical installation or safety design.</p>
 </section>;
}
