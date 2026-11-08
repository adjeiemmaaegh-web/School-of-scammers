/** P1/P3 educational 24V components; original assets, bounded single-lane plant. */
export type ComponentKind = 'supply' | 'plc' | 'plc16' | 'start' | 'stop' | 'contactor' | 'motor' | 'conveyor' | 'photoeye' | 'diverter' | 'tank' | 'pump' | 'levelprobe' | 'drainvalve' | 'breaker' | 'overload' | 'lamp' | 'relay' | 'timerelay' | 'cylinder' | 'stacklight' | 'estop' | 'reversebutton' | 'forwardcontactor' | 'reversecontactor' | 'revmotor';
export type Terminal = { name: string; side: 'left' | 'right'; y: number; role: 'supply' | 'return' | 'passive' | 'input' | 'output' | 'load' | 'analog-input' | 'analog-output' };
export type Definition = { kind: ComponentKind; label: string; help: string; terminals: readonly Terminal[] };
/** Both controller kinds: the fixed 5-in/6-out `plc` and the configurable 16-in/16-out `plc16`. */
export const isPlcKind = (kind: string): boolean => kind === 'plc' || kind === 'plc16';
/** Terminals of the 16-in/16-out controller: L+ and M, 16 digital inputs on the left, 16 outputs on the right. */
export const PLC16_INPUT_TERMINALS = Array.from({ length: 16 }, (_, i) => `I${Math.floor(i / 8)}.${i % 8}`);
export const PLC16_OUTPUT_TERMINALS = Array.from({ length: 16 }, (_, i) => `Q${Math.floor(i / 8)}.${i % 8}`);
const plc16Terminals = (): Terminal[] => [
  { name: 'L+', side: 'left', y: 8, role: 'supply' }, { name: 'M', side: 'left', y: 18, role: 'return' },
  ...PLC16_INPUT_TERMINALS.map((name, i): Terminal => ({ name, side: 'left', y: 30 + i * 6.5, role: 'input' })),
  ...PLC16_OUTPUT_TERMINALS.map((name, i): Terminal => ({ name, side: 'right', y: 30 + i * 6.5, role: 'output' })),
  { name: 'AI0', side: 'left', y: 142, role: 'analog-input' },
  { name: 'AI1', side: 'left', y: 153, role: 'analog-input' },
];
export const COMPONENTS: Record<ComponentKind, Definition> = {
  stacklight: { kind: 'stacklight', label: 'Stack light (R/Y/G)', help: 'Three 24V signal lamps on one column: R, Y and G each to the common M-', terminals: [
    { name: 'R', side: 'left', y: 32, role: 'load' }, { name: 'Y', side: 'left', y: 62, role: 'load' },
    { name: 'G', side: 'left', y: 92, role: 'load' }, { name: 'M-', side: 'left', y: 122, role: 'load' }] },
  relay: { kind: 'relay', label: '24V control relay', help: 'Coil A1/A2 switches two NO contacts (13-14, 23-24) and one NC contact (21-22); hard-wired logic needs no PLC', terminals: [
    { name: 'A1', side: 'left', y: 24, role: 'load' }, { name: 'A2', side: 'left', y: 48, role: 'load' },
    { name: '13', side: 'left', y: 86, role: 'passive' }, { name: '14', side: 'right', y: 86, role: 'passive' },
    { name: '23', side: 'left', y: 112, role: 'passive' }, { name: '24', side: 'right', y: 112, role: 'passive' },
    { name: '21', side: 'left', y: 138, role: 'passive' }, { name: '22', side: 'right', y: 138, role: 'passive' }] },
  timerelay: { kind: 'timerelay', label: '24V on-delay relay', help: 'Coil A1/A2: after the coil has been energised for the set delay (inspector), NO contact 13-14 closes and NC contact 21-22 opens; both release at once when the coil drops. Set the delay while paused.', terminals: [
    { name: 'A1', side: 'left', y: 24, role: 'load' }, { name: 'A2', side: 'left', y: 48, role: 'load' },
    { name: '13', side: 'left', y: 100, role: 'passive' }, { name: '14', side: 'right', y: 100, role: 'passive' },
    { name: '21', side: 'left', y: 126, role: 'passive' }, { name: '22', side: 'right', y: 126, role: 'passive' }] },
  cylinder: { kind: 'cylinder', label: 'Pneumatic cylinder', help: 'Double-acting cylinder: EXT+ / RET+ solenoids to M- (energising both holds it), limit switches EXT_LS / RET_LS powered from L+. Air is assumed available.', terminals: [
    { name: 'EXT+', side: 'left', y: 28, role: 'load' }, { name: 'RET+', side: 'left', y: 54, role: 'load' },
    { name: 'M-', side: 'left', y: 80, role: 'load' }, { name: 'L+', side: 'left', y: 106, role: 'supply' },
    { name: 'EXT_LS', side: 'right', y: 54, role: 'output' }, { name: 'RET_LS', side: 'right', y: 90, role: 'output' }] },
  plc16: { kind: 'plc16', label: 'Virtual PLC 16/16', help: '24V PLC, 16 digital inputs and 16 high-side outputs; two separate numeric AI channels for educational process signals', terminals: plc16Terminals() },
  supply: { kind: 'supply', label: '24V supply', help: 'Educational DC source', terminals: [
    { name: 'P24', side: 'right', y: 45, role: 'supply' }, { name: 'M0', side: 'right', y: 92, role: 'return' }] },
  plc: { kind: 'plc', label: 'Virtual PLC', help: '24V PLC, five digital inputs and six high-side outputs', terminals: [
    { name: 'L+', side: 'left', y: 24, role: 'supply' }, { name: 'M', side: 'left', y: 46, role: 'return' },
    { name: 'I0.0', side: 'left', y: 73, role: 'input' }, { name: 'I0.1', side: 'left', y: 100, role: 'input' },
    { name: 'I0.2', side: 'left', y: 124, role: 'input' },
    { name: 'I0.3', side: 'left', y: 145, role: 'input' },
    { name: 'I0.4', side: 'left', y: 166, role: 'input' },
    { name: 'Q0.0', side: 'right', y: 73, role: 'output' },
    { name: 'Q0.1', side: 'right', y: 100, role: 'output' },
    { name: 'Q0.2', side: 'right', y: 124, role: 'output' },
    { name: 'Q0.3', side: 'right', y: 145, role: 'output' },
    { name: 'Q0.4', side: 'right', y: 166, role: 'output' },
    { name: 'Q0.5', side: 'right', y: 187, role: 'output' }] },
  start: { kind: 'start', label: 'START NO', help: 'Press-to-close pushbutton', terminals: [
    { name: 'A', side: 'left', y: 70, role: 'passive' }, { name: 'B', side: 'right', y: 70, role: 'passive' }] },
  stop: { kind: 'stop', label: 'STOP NC', help: 'Press-to-open ordinary stop pushbutton (not a safety E-stop)', terminals: [
    { name: 'A', side: 'left', y: 70, role: 'passive' }, { name: 'B', side: 'right', y: 70, role: 'passive' }] },
  contactor: { kind: 'contactor', label: 'Contactor', help: 'Coil A1/A2 controls isolated NO 13/14 contact', terminals: [
    { name: 'A1', side: 'left', y: 28, role: 'load' }, { name: 'A2', side: 'left', y: 55, role: 'load' },
    { name: '13', side: 'left', y: 94, role: 'passive' }, { name: '14', side: 'right', y: 94, role: 'passive' }] },
  motor: { kind: 'motor', label: '24V motor', help: 'Simplified DC load; not a mains motor model', terminals: [
    { name: 'L+', side: 'left', y: 48, role: 'load' }, { name: 'M-', side: 'left', y: 94, role: 'load' }] },
  conveyor: { kind: 'conveyor', label: '3D conveyor belt', help: '24V load drives bounded parcels along a single lane', terminals: [
    { name: 'L+', side: 'left', y: 48, role: 'load' }, { name: 'M-', side: 'left', y: 94, role: 'load' }] },
  photoeye: { kind: 'photoeye', label: 'Mark photoeye', help: 'Powered mark-sensitive optical detector; I0.2 high only on marked parcel', terminals: [
    { name: 'L+', side: 'left', y: 28, role: 'supply' }, { name: 'M', side: 'left', y: 55, role: 'return' },
    { name: 'OUT', side: 'right', y: 75, role: 'output' }] },
  diverter: { kind: 'diverter', label: '24V diverter', help: 'Solenoid/actuator; wired Q0.1 selects reject lane at station', terminals: [
    { name: 'A1', side: 'left', y: 47, role: 'load' }, { name: 'A2', side: 'left', y: 93, role: 'load' }] },
  tank: { kind: 'tank', label: '3D process tank', help: 'Passive 1000 ml teaching vessel; LEVEL gives 0–1000 ml on a separate numeric signal (not 24V). Locate the pump/valve nearby.', terminals: [
    { name: 'LEVEL', side: 'right', y: 75, role: 'analog-output' }] },
  pump: { kind: 'pump', label: '24V inlet pump', help: 'Q0.2 Fill output energises the 180 ml/s illustrative inlet pump', terminals: [
    { name: 'L+', side: 'left', y: 48, role: 'load' }, { name: 'M-', side: 'left', y: 94, role: 'load' }] },
  levelprobe: { kind: 'levelprobe', label: 'High-level switch', help: '24V high-side switch with 750/600 ml hysteresis, output to PLC I0.3', terminals: [
    { name: 'L+', side: 'left', y: 28, role: 'supply' }, { name: 'M', side: 'left', y: 55, role: 'return' },
    { name: 'OUT', side: 'right', y: 75, role: 'output' }] },
  drainvalve: { kind: 'drainvalve', label: '24V drain valve', help: 'Q0.3 Drain output energises a simplified 260 ml/s outlet', terminals: [
    { name: 'A1', side: 'left', y: 47, role: 'load' }, { name: 'A2', side: 'left', y: 93, role: 'load' }] },
  reversebutton: { kind: 'reversebutton', label: 'REVERSE NO', help: 'Momentary reverse-request NO button. Wire through I0.4 of PLC.', terminals: [
    { name: 'A', side: 'left', y: 70, role: 'passive' }, { name: 'B', side: 'right', y: 70, role: 'passive' }] },
  forwardcontactor: { kind: 'forwardcontactor', label: 'Forward contactor', help: '24V coil A1/A2; NO 13/14 feeds F+; NC 21/22 blocks the reverse coil.', terminals: [
    { name: 'A1', side: 'left', y: 28, role: 'load' }, { name: 'A2', side: 'left', y: 55, role: 'load' },
    { name: '13', side: 'left', y: 94, role: 'passive' }, { name: '14', side: 'right', y: 94, role: 'passive' },
    { name: '21', side: 'left', y: 121, role: 'passive' }, { name: '22', side: 'right', y: 121, role: 'passive' }] },
  reversecontactor: { kind: 'reversecontactor', label: 'Reverse contactor', help: '24V coil A1/A2; NO 13/14 feeds R+; NC 21/22 blocks the forward coil.', terminals: [
    { name: 'A1', side: 'left', y: 28, role: 'load' }, { name: 'A2', side: 'left', y: 55, role: 'load' },
    { name: '13', side: 'left', y: 94, role: 'passive' }, { name: '14', side: 'right', y: 94, role: 'passive' },
    { name: '21', side: 'left', y: 121, role: 'passive' }, { name: '22', side: 'right', y: 121, role: 'passive' }] },
  revmotor: { kind: 'revmotor', label: 'Reversible 24V motor', help: 'Idealized dual-direction educational drive; F+ or R+ to M- selects shaft direction, both at once inhibits motion. Not 3-phase polarity reversing.', terminals: [
    { name: 'F+', side: 'left', y: 43, role: 'load' },
    { name: 'R+', side: 'left', y: 75, role: 'load' },
    { name: 'M-', side: 'left', y: 105, role: 'load' }] },
  estop: { kind: 'estop', label: 'Emergency stop (training)', help: 'Latching NC contact: pressing opens A/B; manual reset restores. Educational simulation only, NOT safety-rated, redundant or certified.', terminals: [
    { name: 'A', side: 'left', y: 70, role: 'passive' }, { name: 'B', side: 'right', y: 70, role: 'passive' }] },
  breaker: { kind: 'breaker', label: '24V branch breaker', help: 'Idealized two-pole-path DC protection: opens on downstream direct short or manual test; NOT a rated breaker', terminals: [
    { name: 'IN', side: 'left', y: 50, role: 'passive' }, { name: 'OUT', side: 'right', y: 50, role: 'passive' }] },
  overload: { kind: 'overload', label: 'Overload NC auxiliary', help: 'Manual instructional trip/reset opens 95-96 in the contactor coil path; no thermal/current curve', terminals: [
    { name: '95', side: 'left', y: 50, role: 'passive' }, { name: '96', side: 'right', y: 50, role: 'passive' }] },
  lamp: { kind: 'lamp', label: '24V pilot lamp', help: 'Illuminates only when its two actual 24V DC terminals are energized', terminals: [
    { name: 'L+', side: 'left', y: 48, role: 'load' }, { name: 'M-', side: 'left', y: 94, role: 'load' }] },
};
export const componentKinds = Object.keys(COMPONENTS) as ComponentKind[];
export function terminalExists(terminalId: string, components: readonly { id: string; kind: ComponentKind }[]): boolean {
  const dot = terminalId.indexOf('.');
  if (dot < 1) return false;
  const id = terminalId.slice(0, dot), terminal = terminalId.slice(dot + 1);
  const component = components.find(c => c.id === id);
  return !!component && COMPONENTS[component.kind].terminals.some(t => t.name === terminal);
}
