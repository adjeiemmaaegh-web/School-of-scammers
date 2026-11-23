import { useEffect, useState } from 'react';
import { COMPONENTS, isIoModuleKind } from '../../components/registry';
import { modelLimitFor } from '../../components/model-limits';
import { paramSpecsOf, paramValue, type ParamSpec } from '../../components/params';
import type { PlacedComponent, ProjectFile, RenderSnapshot } from '../../sim/signals';
import { perDeviceLive, plantStatusText } from '../../sim/device-state';
import { isP3Equipment } from '../../sim/p3-plant-bridge';
import { OPERATOR_KEYS, OPERATOR_KINDS } from '../../sim/operator-values';

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
  /** Change a device setting (see Command `setParam`). */
  onSetParam: (id: string, key: string, value: number) => void;
  /** Turn a knob / selector / held button live while the simulation runs (see Command `setOperator`). */
  onSetOperator?: (id: string, key: string, value: number) => void;
  /** Attach an expansion I/O module to a 16/16 PLC, or detach it with null (see Command `attachIoModule`). */
  onAttachModule?: (module: string, plc: string | null) => void;
  /** Give one expansion-module channel your own tag name, or null to restore the default (see Command `renameModuleTag`). */
  onRenameModuleTag?: (module: string, tag: string, name: string | null) => void;
};

/** The program tags an attached expansion module adds (see sim/plc-io.ts). */
function moduleTags(kind: string, slot: number): string[] {
  const n = kind === 'io-ai4' ? 4 : kind === 'io-ao2' ? 2 : 8;
  const word = kind === 'io-di8' ? 'In' : kind === 'io-do8' ? 'Out' : kind === 'io-ai4' ? 'Ai' : 'Ao';
  return Array.from({ length: n }, (_, k) => `M${slot}${word}${k}`);
}

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

/** A device setting (e.g. an on-delay relay's delay): a draft that commits on Enter or blur, clamped and snapped to the spec. */
/** A live operator control: a slider for a knob or selector, a hold button for a pushbutton. Works while the simulation runs. */
function OperatorControl({ spec, value, onSet }: { spec: ParamSpec; value: number; onSet: (n: number) => void }) {
  if (spec.max === 1 && spec.step === 1)
    return <button type="button" data-operator={spec.key} className={value === 1 ? 'btn primary small' : 'btn ghost small'} aria-pressed={value === 1}
      onClick={() => onSet(value === 1 ? 0 : 1)}>{spec.label}: {value === 1 ? 'held (click to release)' : 'released (click to hold)'}</button>;
  return <label>{spec.label} ({spec.unit}) <output>{value}</output>
    <input type="range" data-operator={spec.key} min={spec.min} max={spec.max} step={spec.step} value={value} onChange={e => onSet(Number(e.target.value))} />
  </label>;
}
function ParamField({ spec, value, disabled, onCommit }: { spec: ParamSpec; value: number; disabled: boolean; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) { setDraft(String(value)); return; }
    const next = Math.max(spec.min, Math.min(spec.max, Math.round(n / spec.step) * spec.step));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return <label>{spec.label} ({spec.unit})
    <input type="number" data-param={spec.key} min={spec.min} max={spec.max} step={spec.step} value={draft} disabled={disabled}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
  </label>;
}

/** Read-only contextual view of the worker snapshot. Actions emit existing Commands. */
export function WorkbenchInspector({
  project, snapshot, selectedDevice, selectedTerminal, editable,
  onTerminal, onCancelWire, onMove, onMoveTo, onOperate, onClearSelection, onSetParam, onSetOperator, onAttachModule, onRenameModuleTag,
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
    selectedDevice.kind === 'reversebutton' || selectedDevice.kind === 'selector' ? isPressed :
    selectedDevice.kind === 'levelprobe' ? snapshot.io.TankHigh :
    selectedDevice.kind === 'photoeye' ? snapshot.io.Photoeye :
    perDeviceLive(snapshot, selectedDevice) !== undefined ? perDeviceLive(snapshot, selectedDevice) === true :
    selectedDevice.kind === 'start' || selectedDevice.kind === 'stop' || selectedDevice.kind === 'estop' ? !isPressed : true;
  const state = selectedDevice.kind === 'three-phase-supply' ?
    (snapshot.threePhaseSources[selectedDevice.id]===false?'Isolated virtual mains':'Virtual 400V source available') :
    selectedDevice.kind === 'star-delta-drive' ? (()=>{
      const drive=snapshot.threePhase[selectedDevice.id];
      return drive?`${drive.motor.mode.toUpperCase()} · ${Math.round(drive.motor.speedRpm)} rpm · ${drive.motor.currentA.toFixed(1)} A${drive.motor.tripped?' · TRIPPED':''}`:'Not commissioned';
    })() :
selectedDevice.kind === 'revmotor' ? snapshot.motorDirection.toUpperCase() :
    selectedDevice.kind === 'forwardcontactor' ? (isLive ? 'Forward contact closed' : 'Open') :
    selectedDevice.kind === 'reversecontactor' ? (isLive ? 'Reverse contact closed' : 'Open') :
    selectedDevice.kind === 'reversebutton' ? (isPressed ? 'Request pressed' : 'Released') :
    selectedDevice.kind === 'selector' ? (isPressed ? 'Position 2 · contact closed' : 'Position 1 · contact open') :
    selectedDevice.kind === 'buzzer' || selectedDevice.kind === 'siren' ? (isLive ? 'Sounding' : 'Silent') :
    selectedDevice.kind === 'breaker' ? (isLive ? 'Closed' : 'Tripped open') :
    selectedDevice.kind === 'overload' ? (isLive ? '95-96 closed' : '95-96 tripped open') :
    selectedDevice.kind === 'lamp' ? (isLive ? 'Illuminated' : 'Off') :
    selectedDevice.kind === 'stacklight' ? (['R', 'Y', 'G'].filter(l => snapshot.deviceOn[`${selectedDevice.id}-${l}`]).join(' · ') || 'All lamps off') :
    selectedDevice.kind === 'compressor' ? (() => { const a = snapshot.air?.receivers[selectedDevice.id]; return a ? `${a.pressureBar.toFixed(1)} bar${a.pumping ? ' · pump running' : ' · pump stopped'}` : 'Not simulated'; })() :
    selectedDevice.kind === 'air-regulator' ? `Outlet ${(snapshot.air?.working[selectedDevice.id] ?? 0).toFixed(1)} bar` :
    selectedDevice.kind === 'cylinder' ? (() => { const r = snapshot.cylinders[selectedDevice.id]; const base = !r || r.retractLimit ? 'Retracted' : r.extendLimit ? 'Extended' : `Moving ${Math.round(r.position * 100)}%`; return r?.alarm ? `${base} · ${r.alarm}` : base; })() :
    selectedDevice.kind === 'relay' ? (isLive ? 'Energised' : 'Released') :
    selectedDevice.kind === 'timerelay' ? (() => { const t = snapshot.timers[selectedDevice.id]; return !t || t.elapsedMs === 0 ? 'Coil off' : t.done ? 'Contacts transferred' : `Timing ${(t.elapsedMs / 1000).toFixed(1)} / ${(t.delayMs / 1000).toFixed(1)} s`; })() :
    selectedDevice.kind === 'tank' ? `${Math.round(snapshot.vessels[selectedDevice.id]?.levelMl ?? 0)} / 1000 ml` :
    isP3Equipment(selectedDevice.kind) ? (plantStatusText(snapshot.plantWorld.signals[selectedDevice.id]) ?? 'Idle') :
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
    <p className="sandbox-help" data-model-limit>{modelLimitFor(selectedDevice.kind)}</p>
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
    {paramSpecsOf(selectedDevice.kind).length > 0 && <div className="sandbox-inspector-position" role="group" aria-label="Device settings">
      {paramSpecsOf(selectedDevice.kind).map(spec => <ParamField key={`${selectedDevice.id}-${spec.key}`} spec={spec} disabled={!editable}
        value={paramValue(project.params, selectedDevice.id, spec)} onCommit={n => onSetParam(selectedDevice.id, spec.key, n)} />)}
    </div>}
    {isIoModuleKind(selectedDevice.kind) && onAttachModule && <div className="sandbox-inspector-position" role="group" aria-label="Expansion module host">
      <label>Host PLC <select data-module-host value={project.ioModules?.[selectedDevice.id]?.plc ?? ''} disabled={!editable}
        onChange={e => onAttachModule(selectedDevice.id, e.target.value || null)}>
        <option value="">Not attached</option>
        {project.components.filter(c => c.kind === 'plc16').map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
      </select></label>
      {project.ioModules?.[selectedDevice.id] && <div data-module-tags>
        <p className="sandbox-help">Channel tags (type a new name and press Enter or leave the field; empty restores the default):</p>
        {moduleTags(selectedDevice.kind, project.ioModules[selectedDevice.id]!.slot).map(tag => <label key={tag} className="sandbox-module-tag">
          <code>{tag}</code>
          <input type="text" data-module-tag={tag} disabled={!editable || !onRenameModuleTag} maxLength={24}
            defaultValue={project.ioModules![selectedDevice.id]!.names?.[tag] ?? tag}
            key={`${tag}-${project.ioModules![selectedDevice.id]!.names?.[tag] ?? tag}`}
            onBlur={e => { const v = e.target.value.trim(); const cur = project.ioModules![selectedDevice.id]!.names?.[tag] ?? tag; if (v !== cur) onRenameModuleTag?.(selectedDevice.id, tag, v === '' || v === tag ? null : v); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        </label>)}
      </div>}
    </div>}
    {OPERATOR_KINDS.has(selectedDevice.kind) && onSetOperator && <div className="sandbox-inspector-position" role="group" aria-label="Operator controls (live)">
      {paramSpecsOf(selectedDevice.kind).filter(spec => OPERATOR_KEYS.has(spec.key)).map(spec =>
        <OperatorControl key={`${selectedDevice.id}-op-${spec.key}`} spec={spec}
          value={snapshot.operatorValues?.[selectedDevice.id]?.[spec.key] ?? paramValue(project.params, selectedDevice.id, spec)}
          onSet={n => onSetOperator(selectedDevice.id, spec.key, n)} />)}
    </div>}
    <p className="sandbox-help">Sensors, diverters, pumps and level switches act on the conveyor or tank they are placed beside, so exact positions matter.</p>
    <button type="button" className="btn ghost small sandbox-inspector-move" disabled={!editable}
      onClick={() => onMove(selectedDevice.id)}>Move on 3D floor</button>
    {(selectedDevice.kind === 'start' || selectedDevice.kind === 'stop' || selectedDevice.kind === 'estop' || selectedDevice.kind === 'reversebutton' || selectedDevice.kind === 'selector') &&
      <button type="button" className="btn primary small sandbox-inspector-operate"
        onClick={() => onOperate(selectedDevice.id)}>
        {selectedDevice.kind === 'estop' ?
          (isPressed ? 'Reset training E-stop' : 'Press training E-stop') :
          selectedDevice.kind === 'selector' ? (isPressed ? 'Turn to position 1' : 'Turn to position 2') :
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
