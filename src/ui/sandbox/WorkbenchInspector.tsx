import { COMPONENTS } from '../../components/registry';
import type { PlacedComponent, ProjectFile, RenderSnapshot } from '../../sim/signals';

type Props = {
  project: ProjectFile;
  snapshot: RenderSnapshot;
  selectedDevice: PlacedComponent | null;
  selectedTerminal: string | null;
  editable: boolean;
  onTerminal: (pin: string) => void;
  onCancelWire: () => void;
  onMove: (id: string) => void;
  onOperate: (id: string, pressed: boolean) => void;
  onClearSelection: () => void;
};

/** Read-only contextual view of the worker snapshot. Actions emit existing Commands. */
export function WorkbenchInspector({
  project, snapshot, selectedDevice, selectedTerminal, editable,
  onTerminal, onCancelWire, onMove, onOperate, onClearSelection,
}: Props) {
  const hasLatchBranch = project.program.rungs.some(rung =>
    rung.elements.some(element => element.type === 'branch'));
  const milestones = [
    { label: 'Place your devices', value: `${project.components.length} placed`,
      hint: 'Use the library or drop equipment onto the 3D floor', started: project.components.length > 0 },
    { label: 'Patch electrical terminals', value: `${project.wires.length} wires`,
      hint: 'Choose a first terminal, then a second; connections are not pre-verified', started: project.wires.length > 0 },
    { label: 'Edit Ladder Logic', value: hasLatchBranch ? 'Parallel path present' : 'Program a rung',
      hint: 'Use the editor to create a start/stop seal-in', started: hasLatchBranch },
    { label: 'Commission the motor', value: snapshot.tick ? `${snapshot.tick} scans` : 'Not run',
      hint: 'Run and check the motor, then deliberately break the logic or wiring', started: snapshot.tick > 0 },
  ];

  if (!selectedDevice) {
    return <aside className="sandbox-inspector panel" aria-label="Workbench inspector">
      <div className="sandbox-inspector-heading"><span className="eyebrow">Context</span><h2>Build checklist</h2></div>
      <p className="sandbox-inspector-summary">A practical route from blank project to a working motor. Counts describe the project; they do not certify the wiring.</p>
      <ol className="sandbox-milestones">
        {milestones.map((step, index) => <li key={step.label} className={step.started ? 'is-started' : ''}>
          <span className="sandbox-milestone-index">{index + 1}</span>
          <div><strong>{step.label}</strong><span className="sandbox-milestone-value">{step.value}</span><small>{step.hint}</small></div>
        </li>)}
      </ol>
      <p className="sandbox-inspector-note">Select a model in 3D or use <strong>Inspect</strong> in the component list to see terminal details and controls.</p>
      {selectedTerminal && <div className="sandbox-pending-wire" role="status"><strong>Wire started</strong>
        <code>{selectedTerminal}</code><span>Choose a second terminal to connect.</span>
        <button type="button" className="btn ghost small" onClick={onCancelWire}>Cancel wire</button>
      </div>}
    </aside>;
  }

  const definition = COMPONENTS[selectedDevice.kind];
  const isPressed = selectedDevice.pressed;
  const isLive = selectedDevice.kind === 'pump' ? snapshot.pumpOn :
    selectedDevice.kind === 'levelprobe' ? snapshot.io.TankHigh :
    selectedDevice.kind === 'drainvalve' ? snapshot.drainOn :
    selectedDevice.kind === 'conveyor' ? snapshot.conveyorOn :
    selectedDevice.kind === 'photoeye' ? snapshot.io.Photoeye :
    selectedDevice.kind === 'diverter' ? snapshot.diverterOn :
    selectedDevice.kind === 'motor' ? snapshot.motorOn :
    selectedDevice.kind === 'contactor' ? snapshot.contactorOn :
    selectedDevice.kind === 'plc' ? snapshot.io.PlcPowered :
    selectedDevice.kind === 'start' || selectedDevice.kind === 'stop' ? isPressed : true;
  const state = selectedDevice.kind === 'tank' ? `${Math.round(snapshot.tank.levelMl)} / 1000 ml` :
    selectedDevice.kind === 'pump' ? (isLive ? 'Filling' : 'Off') :
    selectedDevice.kind === 'levelprobe' ? (isLive ? 'High level' : 'Below level switch') :
    selectedDevice.kind === 'drainvalve' ? (isLive ? 'Open' : 'Closed') :
    selectedDevice.kind === 'conveyor' ? (isLive ? 'Belt moving' : 'Belt stopped') :
    selectedDevice.kind === 'photoeye' ? (isLive ? 'Mark detected' : 'No mark') :
    selectedDevice.kind === 'diverter' ? (isLive ? 'Reject active' : 'Pass position') :
    selectedDevice.kind === 'motor' ? (isLive ? 'Running' : 'Stopped') :
    selectedDevice.kind === 'contactor' ? (isLive ? 'Coil energised' : 'Coil off') :
    selectedDevice.kind === 'plc' ? (isLive ? 'Powered' : 'Unpowered') :
    selectedDevice.kind === 'supply' ? '24V DC source' : isPressed ? 'Pressed' : 'Released';

  return <aside className="sandbox-inspector panel" aria-label="Workbench inspector">
    <div className="sandbox-inspector-top">
      <div><span className="eyebrow">Selected equipment</span><h2>{definition.label}</h2></div>
      <button type="button" className="sandbox-inspector-close" onClick={onClearSelection} aria-label="Clear equipment selection">×</button>
    </div>
    <p className="sandbox-help">{definition.help}</p>
    <div className="sandbox-inspector-properties">
      <span>Device ID</span><code>{selectedDevice.id}</code>
      <span>Live state</span><strong className={isLive ? 'is-live' : ''}>{state}</strong>
      <span>Location</span><code>{Math.round(selectedDevice.x)}, {Math.round(selectedDevice.y)}</code>
    </div>
    <button type="button" className="btn ghost small sandbox-inspector-move" disabled={!editable}
      onClick={() => onMove(selectedDevice.id)}>Move on 3D floor</button>
    {(selectedDevice.kind === 'start' || selectedDevice.kind === 'stop') &&
      <button type="button" className="btn primary small sandbox-inspector-operate"
        onClick={() => onOperate(selectedDevice.id, !isPressed)}>
        {isPressed ? 'Release pushbutton' : 'Press pushbutton'}
      </button>}
    <div className="sandbox-inspector-subheading"><h3>Terminals</h3><small>{definition.terminals.length ?
        'Click two pins to wire' : 'Passive process device (no electrical terminals)'}</small></div>
    <div className="sandbox-inspector-terminals">
      {definition.terminals.map(t => {
        const id = `${selectedDevice.id}.${t.name}`;
        const voltage = snapshot.voltages[id];
        return <button key={id} type="button" data-inspector-terminal-id={id}
          disabled={!editable} aria-pressed={selectedTerminal === id}
          className={selectedTerminal === id ? 'selected' : ''}
          onClick={() => onTerminal(id)}>
          <code>{t.name}</code>
          <span>{voltage === undefined ? t.role : voltage === null ? 'floating' : `${voltage} V`}</span>
        </button>;
      })}
    </div>
    {selectedTerminal && <div className="sandbox-pending-wire" role="status">
      <strong>Connecting from</strong><code>{selectedTerminal}</code>
      <button type="button" className="btn ghost small" onClick={onCancelWire}>Cancel wire</button>
    </div>}
  </aside>;
}
