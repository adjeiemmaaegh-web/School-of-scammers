/** P1/P3 educational 24V components; original assets, bounded single-lane plant. */
export type ComponentKind = 'supply' | 'plc' | 'start' | 'stop' | 'contactor' | 'motor' | 'conveyor' | 'photoeye' | 'diverter' | 'tank' | 'pump' | 'levelprobe' | 'drainvalve';
export type Terminal = { name: string; side: 'left' | 'right'; y: number; role: 'supply' | 'return' | 'passive' | 'input' | 'output' | 'load' };
export type Definition = { kind: ComponentKind; label: string; help: string; terminals: readonly Terminal[] };
export const COMPONENTS: Record<ComponentKind, Definition> = {
  supply: { kind: 'supply', label: '24V supply', help: 'Educational DC source', terminals: [
    { name: 'P24', side: 'right', y: 45, role: 'supply' }, { name: 'M0', side: 'right', y: 92, role: 'return' }] },
  plc: { kind: 'plc', label: 'Virtual PLC', help: '24V PLC, four digital inputs and four high-side outputs', terminals: [
    { name: 'L+', side: 'left', y: 24, role: 'supply' }, { name: 'M', side: 'left', y: 46, role: 'return' },
    { name: 'I0.0', side: 'left', y: 73, role: 'input' }, { name: 'I0.1', side: 'left', y: 100, role: 'input' },
    { name: 'I0.2', side: 'left', y: 124, role: 'input' },
    { name: 'I0.3', side: 'left', y: 145, role: 'input' },
    { name: 'Q0.0', side: 'right', y: 73, role: 'output' },
    { name: 'Q0.1', side: 'right', y: 100, role: 'output' },
    { name: 'Q0.2', side: 'right', y: 124, role: 'output' },
    { name: 'Q0.3', side: 'right', y: 145, role: 'output' }] },
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
  tank: { kind: 'tank', label: '3D process tank', help: 'Passive 1000 ml teaching vessel. Locate inlet pump, level probe and outlet valve nearby.', terminals: [] },
  pump: { kind: 'pump', label: '24V inlet pump', help: 'Q0.2 Fill output energises the 180 ml/s illustrative inlet pump', terminals: [
    { name: 'L+', side: 'left', y: 48, role: 'load' }, { name: 'M-', side: 'left', y: 94, role: 'load' }] },
  levelprobe: { kind: 'levelprobe', label: 'High-level switch', help: '24V high-side switch with 750/600 ml hysteresis, output to PLC I0.3', terminals: [
    { name: 'L+', side: 'left', y: 28, role: 'supply' }, { name: 'M', side: 'left', y: 55, role: 'return' },
    { name: 'OUT', side: 'right', y: 75, role: 'output' }] },
  drainvalve: { kind: 'drainvalve', label: '24V drain valve', help: 'Q0.3 Drain output energises a simplified 260 ml/s outlet', terminals: [
    { name: 'A1', side: 'left', y: 47, role: 'load' }, { name: 'A2', side: 'left', y: 93, role: 'load' }] },
};
export const componentKinds = Object.keys(COMPONENTS) as ComponentKind[];
export function terminalExists(terminalId: string, components: readonly { id: string; kind: ComponentKind }[]): boolean {
  const dot = terminalId.indexOf('.');
  if (dot < 1) return false;
  const id = terminalId.slice(0, dot), terminal = terminalId.slice(dot + 1);
  const component = components.find(c => c.id === id);
  return !!component && COMPONENTS[component.kind].terminals.some(t => t.name === terminal);
}
