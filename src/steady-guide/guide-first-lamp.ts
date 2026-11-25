/** Ungraded virtual 24 V circuit. Teaching data only; never a project command. */
import type {ComponentKind} from '../components/registry';
export const FIRST_LAMP_PARTS=['supply','start','lamp'] as const satisfies readonly ComponentKind[];
export type FirstLampKind=(typeof FIRST_LAMP_PARTS)[number];
type TerminalRef={kind:FirstLampKind;terminal:string};
export const FIRST_LAMP_WIRES=[
 {from:{kind:'supply',terminal:'P24'},to:{kind:'start',terminal:'A'}},
 {from:{kind:'start',terminal:'B'},to:{kind:'lamp',terminal:'L+'}},
 {from:{kind:'lamp',terminal:'M-'},to:{kind:'supply',terminal:'M0'}},
] as const satisfies readonly {from:TerminalRef;to:TerminalRef}[];
