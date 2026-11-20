/** Read-only source of truth for the ungraded first-lamp beginner exercise.
 * No project builder, grader, worker command or real-world wiring approval.
 */
import type {ComponentKind} from '../components/registry';
export const FIRST_LAMP_PARTS=['supply','start','lamp'] as const satisfies readonly ComponentKind[];
export type FirstLampKind=(typeof FIRST_LAMP_PARTS)[number];
export type FirstLampTerminalRef={kind:FirstLampKind;terminal:string};
type LampLink={from:FirstLampTerminalRef;to:FirstLampTerminalRef};
export const FIRST_LAMP_WIRES:readonly LampLink[]=[
 {from:{kind:'supply',terminal:'P24'},to:{kind:'start',terminal:'A'}},
 {from:{kind:'start',terminal:'B'},to:{kind:'lamp',terminal:'L+'}},
 {from:{kind:'lamp',terminal:'M-'},to:{kind:'supply',terminal:'M0'}},
] as const;
export const FIRST_LAMP_LABELS:Record<FirstLampKind,string>={
 supply:'24V supply',start:'START NO pushbutton',lamp:'24V pilot lamp',
};
export function firstLampTerminalName(ref:FirstLampTerminalRef){
 return FIRST_LAMP_LABELS[ref.kind]+' · '+ref.terminal;
}
