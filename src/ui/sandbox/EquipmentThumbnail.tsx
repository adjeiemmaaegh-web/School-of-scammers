/**
 * UX2 original, offline SVG equipment illustrations.
 *
 * The palette is driven ONLY by registered ComponentKind values.
 * These drawings are recognisable teaching pictograms, not copied vendor imagery
 * or proof of physical device/firmware fidelity. They do not mutate any worker state.
 */
import type { ComponentKind } from '../../components/registry';
import { familyForKind } from './workspace-catalog';

export function EquipmentThumbnail({ kind }: { kind: ComponentKind }) {
  const family = familyForKind(kind);
  const plc = family === 'plc';
  const sensor = family === 'sensors';
  const motor = family === 'drives' || kind === 'pump' || kind === 'star-delta-drive';
  const handling = family === 'handling';
  const process = family === 'process' && !motor;
  const motion = family === 'motion';
  const indicator = family === 'indicators';
  const pushButton = ['start','stop','reversebutton','estop','selector'].includes(kind);
  const supply = kind === 'supply' || kind === 'three-phase-supply';
  const contact = ['breaker','overload','contactor','forwardcontactor','reversecontactor','relay','timerelay'].includes(kind);
  const danger = ['stop','estop'].includes(kind);
  const blue = '#287bb0';
  const orange = '#f1aa36';
  return (
    <svg className="ux2-equipment-thumbnail" viewBox="0 0 92 72" fill="none"
      aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="46" cy="66" rx="33" ry="4" fill="#081423" opacity=".35" />
      {plc && <>
        <rect x="12" y="10" width="68" height="51" rx="3" fill="#a7b3b8" stroke="#dfe5e9" strokeWidth="1.3" />
        <rect x="17" y="14" width="58" height="43" rx="2" fill="#3c515d" stroke="#1a2f3e" />
        <rect x="23" y="23" width="27" height="19" rx="2" fill="#1c3043" />
        <rect x="26" y="27" width="21" height="11" rx="1" fill={blue} opacity=".85" />
        <path d="M55 24h14 M55 31h14 M55 38h14" stroke="#9eb2bc" strokeWidth="2" />
        {Array.from({length:8},(_,i)=><rect key={i} x={18+i*7.3} y="47" width="4" height="5" rx=".7"
          fill={i<4?'#80d7aa':'#f0b14b'}/>)}
        <path d="M19 11v6M26 11v6M33 11v6M40 11v6M49 11v6M56 11v6M63 11v6M70 11v6" stroke="#233a47" strokeWidth="2"/>
      </>}
      {supply && <>
        <rect x="22" y="8" width="48" height="54" rx="4" fill="#c7d0d3" stroke="#eef3f4" strokeWidth="1.5"/>
        <path d="M28 16h36M28 19h36M28 22h36" stroke="#738891" strokeWidth="2"/>
        <rect x="30" y="29" width="31" height="18" rx="2" fill="#788d94"/>
        <path d="M36 36h19M36 40h15" stroke="#cfdcde" strokeWidth="2"/>
        <rect x="28" y="51" width="12" height="5" rx="1" fill="#d89a35"/>
        <rect x="46" y="51" width="12" height="5" rx="1" fill="#326e9e"/>
      </>}
      {pushButton && <>
        <rect x="25" y="21" width="43" height="36" rx="3" fill="#b8c5ca" stroke="#e3eef1" strokeWidth="1.5"/>
        <rect x="33" y="52" width="27" height="7" rx="2" fill="#6a858e"/>
        <circle cx="46" cy="30" r={kind==='estop'?20:17} fill="#243745" stroke="#e2e9e8" strokeWidth="2"/>
        <circle cx="46" cy="30" r={kind==='estop'?16:13} fill={danger?'#d83937':kind==='reversebutton'?'#dfac3c':'#28a56e'} stroke="#20313d" strokeWidth="2"/>
        <ellipse cx="41" cy="24" rx="8" ry="4" fill="#fff" opacity=".25"/>
      </>}
      {contact && <>
        <rect x="25" y="8" width="43" height="55" rx="3" fill="#c3cbd0" stroke="#f0f2f4" strokeWidth="1.5"/>
        <rect x="30" y="14" width="33" height="15" rx="1.5" fill="#333f49"/>
        <path d="M33 18h27M33 22h23" stroke="#b2c6cd" strokeWidth="1.2"/>
        <rect x="31" y="37" width="31" height="14" rx="2" fill="#f0f3f3"/>
        <rect x="35" y="40" width="9" height="9" rx="1" fill="#4e6370"/>
        <rect x="48" y="40" width="10" height="9" rx="1" fill="#6e858e"/>
        {Array.from({length:4},(_,i)=><rect key={i} x={28+i*10.2} y="55" width="6" height="4" rx=".6" fill={i%2?'#bb8b43':'#657b88'}/>)}
      </>}
      {motor && <>
        <path d="M14 33h15v16H14z" fill="#496575"/>
        <rect x="28" y="21" width="44" height="35" rx="12" fill={blue} stroke="#a4d5ed" strokeWidth="2"/>
        <ellipse cx="71" cy="38" rx="10" ry="17" fill="#15567f" stroke="#81bdde" strokeWidth="2"/>
        <path d="M31 27v23M39 23v31M47 22v34M55 23v31M63 26v26" stroke="#91cce8" strokeWidth="2" opacity=".8"/>
        <path d="M81 37h8" stroke="#ccd8df" strokeWidth="5" strokeLinecap="round"/>
        <path d="M31 57v6M63 57v6" stroke="#7e9fb1" strokeWidth="6"/>
      </>}
      {sensor && <>
        <rect x="32" y="12" width="35" height="48" rx="4" fill={['photoeye','geometry-photoeye'].includes(kind)?'#e3b13d':'#839ba7'} stroke="#e4edf1" strokeWidth="1.5"/>
        <rect x="39" y="20" width="21" height="22" rx="3" fill="#202e38"/>
        <circle cx="49" cy="31" r="6" fill="#c33842"/>
        <circle cx="49" cy="31" r="2" fill="#ff9a89"/>
        <path d="M68 28h17" stroke="#ff6a55" strokeWidth="2" strokeDasharray="4 3"/>
        <path d="M45 59v7" stroke="#263d4d" strokeWidth="3"/>
      </>}
      {handling && <>
        <path d="M13 29L65 18l15 17-52 11z" fill="#647783" stroke="#c1d2dc" strokeWidth="2"/>
        <path d="M27 46v16M76 35v24M16 32v23" stroke="#7f98a8" strokeWidth="4"/>
        {Array.from({length:5},(_,i)=><path key={i} d={`M${19+i*9} ${28-i*1.8}l15 15`}
          stroke="#c4d4dd" strokeWidth="4" strokeLinecap="round"/>)}
        <rect x="61" y="45" width="16" height="14" rx="3" fill={blue}/>
        <circle cx="74" cy="52" r="6" fill="#1e5071" stroke="#85b4cf" strokeWidth="2"/>
      </>}
      {process && <>
        <path d="M20 20h50v34c0 13-50 13-50 0z" fill="#647d8c" stroke="#c5d8e2" strokeWidth="2"/>
        <ellipse cx="45" cy="20" rx="25" ry="7" fill="#a1b3bd" stroke="#d6e0e6" strokeWidth="2"/>
        <path d="M22 39h46v12c0 12-46 12-46 0z" fill="#3392b3" opacity=".82"/>
        <path d="M27 12v-5h35v5M71 31h9v16h-9" stroke="#96c1d0" strokeWidth="4"/>
        <path d="M29 58v7M61 58v7" stroke="#768f9e" strokeWidth="4"/>
      </>}
      {motion && <>
        <rect x="12" y="23" width="48" height="29" rx="5" fill="#829aa8" stroke="#e1eaf0" strokeWidth="2"/>
        <rect x="20" y="29" width="30" height="16" rx="3" fill="#536e7f"/>
        <path d="M59 37h20" stroke="#cfdce2" strokeWidth="7" strokeLinecap="round"/>
        <rect x="76" y="30" width="9" height="16" rx="2" fill={orange}/>
        <path d="M21 52v9M50 52v9" stroke="#768d9d" strokeWidth="5"/>
      </>}
      {indicator && <>
        <rect x="39" y="11" width="17" height="43" rx="4" fill="#2b3e4b" stroke="#a5b9c2" strokeWidth="1.5"/>
        {['#dc524b','#e5aa44','#39b982'].map((c,i)=><circle key={i} cx="47.5" cy={19+i*12} r="5" fill={c}/>)}
        <path d="M47 54v10" stroke="#a1b9c5" strokeWidth="4"/>
      </>}
      {!plc&&!supply&&!pushButton&&!contact&&!motor&&!sensor&&!handling&&!process&&!motion&&!indicator && <>
        <rect x="20" y="12" width="52" height="49" rx="4" fill="#91a8b4" stroke="#d6e8f0" strokeWidth="2"/>
        <rect x="26" y="18" width="40" height="32" rx="2" fill="#345469"/>
        <circle cx="46" cy="34" r="11" stroke="#81c5e3" strokeWidth="3"/>
      </>}
    </svg>
  );
}
