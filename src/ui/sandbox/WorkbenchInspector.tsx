import { useEffect, useState } from 'react';
import { COMPONENTS } from '../../components/registry';
import type { PlacedComponent, ProjectFile, RenderSnapshot } from '../../sim/signals';
import { perDeviceLive } from '../../sim/device-state';

type Props = {
  project: ProjectFile;
  snapshot: RenderSnapshot;
  selectedDevice: PlacedComponent | null;
  selectedTerminal: string | null;
  editable: boolean;
  onTerminal: (pin: string) => void;
  onCancelWire: () => void;
  onMove: (id: string) => void;
  /** Place a device at exact floor coordinates (precise, keyboard-friendly alternative to dragging). */
  onMoveTo: (id: string, at: { x: number; y: number }) => void;
  /** Toggle a pushbutton/E-stop. The worker resolves the new state (see Command `operateToggle`). */
  onOperate: (id: string) => void;
  onClearSelection: () => void;
};

/** Largest top-left coordinates that keep a device (170 x 130) on the 1080 x 580 floor. */
const FLOOR_MAX_X = 910, FLOOR_MAX_Y = 450;

/** A number field that edits a draft and commits on Enter or blur, so typing is never overwritten by a stale snapshot. */
function PositionField({ label, attr, max, value, disabled, onCommit }: {
  label: string; attr: string; max: number; value: number; disabled: boolean; onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => { setDraft(String(Math.round(value))); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) { setDraft(String(Math.round(value))); return; }
    const next = Math.max(0, Math.min(max, Math.round(n)));
    setDraft(String(next));
    if (next !== Math.round(value)) onCommit(next);
  };
  return <label>{label}
    <input type="number" {...{ [attr]: '' }} min={0} max={max} step={5} value={draft} disabled={disabled}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
  </label>;
}

/** Read-only contextual view of the worker snapshot. Actions emit existing Commands. */
export function WorkbenchInspector({
  project, snapshot, selectedDevice, selectedTerminal, editable,
  onTerminal, onCancelWire, onMove, onMoveTo, onOperate, onClearSelection,
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
  const isLive = selectedDevice.kind === 'revmotor' ? snapshot.motorDirection !== 'stopped' :
    selectedDevice.kind === 'forwardcontactor' ? snapshot.forwardContactorOn :
    selectedDevice.kind === 'reversecontactor' ? snapshot.reverseContactorOn :
    selectedDevice.kind === 'reversebutton' ? isPressed :
    selectedDevice.kind === 'levelprobe' ? snapshot.io.TankHigh :
    selectedDevice.kind === 'photoeye' ? snapshot.io.Photoeye :
    perDeviceLive(snapshot, selectedDevice) !== undefined ? perDeviceLive(snapshot, selectedDevice) === true :
    selectedDevice.kind === 'start' || selectedDevice.kind === 'stop' || selectedDevice.kind === 'estop' ? !isPressed : true;
  const state = selectedDevice.kind === 'revmotor' ? snapshot.motorDirection.toUpperCase() :
    selectedDevice.kind === 'forwardcontactor' ? (isLive ? 'Forward contact closed' : 'Open') :
    selectedDevice.kind === 'reversecontactor' ? (isLive ? 'Reverse contact closed' : 'Open') :
    selectedDevice.kind === 'reversebutton' ? (isPressed ? 'Request pressed' : 'Released') :
    selectedDevice.kind === 'breaker' ? (isLive ? 'Closed' : 'Tripped open') :
    selectedDevice.kind === 'overload' ? (isLive ? '95-96 closed' : '95-96 tripped open') :
    selectedDevice.kind === 'lamp' ? (isLive ? 'Illuminated' : 'Off') :
    selectedDevice.kind === 'cylinder' ? (() => { const r = snapshot.cylinders[selectedDevice.id]; return !r || r.retractLimit ? 'Retracted' : r.extendLimit ? 'Extended' : `Moving ${Math.round(r.position * 100)}%`; })() :
    selectedDevice.kind === 'relay' ? (isLive ? 'Energised' : 'Released') :
    selectedDevice.kind === 'tank' ? `${Math.round(snapshot.vessels[selectedDevice.id]?.levelMl ?? 0)} / 1000 ml` :
    selectedDevice.kind === 'pump' ? (isLive ? 'Filling' : 'Off') :
    selectedDevice.kind === 'levelprobe' ? (isLive ? 'High level' : 'Below level switch') :
    selectedDevice.kind === 'drainvalve' ? (isLive ? 'Open' : 'Closed') :
    selectedDevice.kind === 'conveyor' ? (isLive ? 'Belt moving' : 'Belt stopped') :
    selectedDevice.kind === 'photoeye' ? (isLive ? 'Mark detected' : 'No mark') :
    selectedDevice.kind === 'diverter' ? (isLive ? 'Reject active' : 'Pass position') :
    selectedDevice.kind === 'motor' ? (isLive ? 'Running' : 'Stopped') :
    selectedDevice.kind === 'contactor' ? (isLive ? 'Coil energised' : 'Coil off') :
    (selectedDevice.kind === 'plc' || selectedDevice.kind === 'plc16') ? (isLive ? 'Powered' : 'Unpowered') :
    selectedDevice.kind === 'supply' ? '24V DC source' :
    selectedDevice.kind === 'estop' ? (isPressed ? 'NC open · latched' : 'NC closed · reset') :
    isPressed ? 'Pressed' : 'Released';

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
    <div className="sandbox-inspector-position" role="group" aria-label="Exact position on the floor">
      <PositionField key={`${selectedDevice.id}-x`} label="X" attr="data-pos-x" max={FLOOR_MAX_X} value={selectedDevice.x} disabled={!editable}
        onCommit={x => onMoveTo(selectedDevice.id, { x, y: selectedDevice.y })} />
      <PositionField key={`${selectedDevice.id}-y`} label="Y" attr="data-pos-y" max={FLOOR_MAX_Y} value={selectedDevice.y} disabled={!editable}
        onCommit={y => onMoveTo(selectedDevice.id, { x: selectedDevice.x, y })} />
    </div>
    <p className="sandbox-help">Sensors, diverters, pumps and level switches act on the conveyor or tank they are placed beside, so exact positions matter.</p>
    <button type="button" className="btn ghost small sandbox-inspector-move" disabled={!editable}
      onClick={() => onMove(selectedDevice.id)}>Move on 3D floor</button>
    {(selectedDevice.kind === 'start' || selectedDevice.kind === 'stop' || selectedDevice.kind === 'estop' || selectedDevice.kind === 'reversebutton') &&
      <button type="button" className="btn primary small sandbox-inspector-operate"
        onClick={() => onOperate(selectedDevice.id)}>
        {selectedDevice.kind === 'estop' ?
          (isPressed ? 'Reset training E-stop' : 'Press training E-stop') :
          isPressed ? 'Release pushbutton' : 'Press pushbutton'}
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
