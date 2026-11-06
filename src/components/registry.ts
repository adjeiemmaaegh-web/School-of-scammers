/** P1 educational 24V components; all assets and behaviour are original. */
export type ComponentKind = 'supply' | 'plc' | 'start' | 'stop' | 'contactor' | 'motor';
export type Terminal = { name: string; side: 'left' | 'right'; y: number; role: 'supply' | 'return' | 'passive' | 'input' | 'output' | 'load' };
export type Definition = { kind: ComponentKind; label: string; help: string; terminals: readonly Terminal[] };
export const COMPONENTS: Record<ComponentKind, Definition> = {
  supply: { kind: 'supply', label: '24V supply', help: 'Educational DC source', terminals: [
    { name: 'P24', side: 'right', y: 45, role: 'supply' }, { name: 'M0', side: 'right', y: 92, role: 'return' }] },
  plc: { kind: 'plc', label: 'Virtual PLC', help: '24V powered, two inputs, one high-side output', terminals: [
    { name: 'L+', side: 'left', y: 24, role: 'supply' }, { name: 'M', side: 'left', y: 46, role: 'return' },
    { name: 'I0.0', side: 'left', y: 73, role: 'input' }, { name: 'I0.1', side: 'left', y: 100, role: 'input' },
    { name: 'Q0.0', side: 'right', y: 73, role: 'output' }] },
  start: { kind: 'start', label: 'START NO', help: 'Press-to-close pushbutton', terminals: [
    { name: 'A', side: 'left', y: 70, role: 'passive' }, { name: 'B', side: 'right', y: 70, role: 'passive' }] },
  stop: { kind: 'stop', label: 'STOP NC', help: 'Press-to-open ordinary stop pushbutton (not a safety E-stop)', terminals: [
    { name: 'A', side: 'left', y: 70, role: 'passive' }, { name: 'B', side: 'right', y: 70, role: 'passive' }] },
  contactor: { kind: 'contactor', label: 'Contactor', help: 'Coil A1/A2 controls isolated NO 13/14 contact', terminals: [
    { name: 'A1', side: 'left', y: 28, role: 'load' }, { name: 'A2', side: 'left', y: 55, role: 'load' },
    { name: '13', side: 'left', y: 94, role: 'passive' }, { name: '14', side: 'right', y: 94, role: 'passive' }] },
  motor: { kind: 'motor', label: '24V motor', help: 'Simplified DC load; not a mains motor model', terminals: [
    { name: 'L+', side: 'left', y: 48, role: 'load' }, { name: 'M-', side: 'left', y: 94, role: 'load' }] },
};
export const componentKinds = Object.keys(COMPONENTS) as ComponentKind[];
export function terminalExists(terminalId: string, components: readonly { id: string; kind: ComponentKind }[]): boolean {
  const dot = terminalId.lastIndexOf('.');
  if (dot < 1) return false;
  const id = terminalId.slice(0, dot), terminal = terminalId.slice(dot + 1);
  const component = components.find(c => c.id === id);
  return !!component && COMPONENTS[component.kind].terminals.some(t => t.name === terminal);
}
