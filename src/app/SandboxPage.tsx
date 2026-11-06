import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { COMPONENTS, componentKinds, type ComponentKind } from '../components/registry';
import { AppHeader } from '../ui/AppHeader';
import { ProgrammingDock } from '../program/ProgrammingDock';
import { LiveMonitor } from '../program/LiveMonitor';
import { WorkbenchInspector } from '../ui/sandbox/WorkbenchInspector';
import type { Command, ProjectFile, RenderSnapshot, WorkerResponse } from '../sim/signals';
import './sandbox.css';

const Sandbox3D = lazy(() => import('../render/Sandbox3D').then(module => ({ default: module.Sandbox3D })));
const STORAGE_KEY = 'efo-open-sandbox-project-v1';
const CANVAS_W = 1080, CANVAS_H = 580, BOX_W = 170;
const wireGuide = 'Supply P24 → PLC L+, START A, STOP A, contactor 13. Supply M0 → PLC M, contactor A2, motor M-. START B → PLC I0.0; STOP B → PLC I0.1; PLC Q0.0 → contactor A1; contactor 14 → motor L+.';
const sortingWireGuide = 'For 3D sorting: supply P24 → PLC L+, START A, STOP A, contactor 13, photoeye L+. Supply M0 → PLC M, contactor A2, conveyor M-, photoeye M, diverter A2. START B → I0.0; STOP B → I0.1; PLC Q0.0 → contactor A1; contactor 14 → conveyor L+. Photoeye OUT → PLC I0.2; PLC Q0.1 → diverter A1. Load the sorting Ladder example, Run, press START, and feed marked or plain parcels. Photoeye and diverter must be positioned alongside the conveyor in sensor→diverter order.';
export function SandboxPage() {
  const [snapshot, setSnapshot] = useState<RenderSnapshot | null>(null);
  const [project, setProject] = useState<ProjectFile | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [activeStage, setActiveStage] = useState<'build' | 'wire' | 'program' | 'test'>('build');
  const [localSave, setLocalSave] = useState<'pending' | 'saved' | 'failed'>('pending');
  const [events, setEvents] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const send = useCallback((commands: Command[]) => {
    worker.current?.postMessage({ kind: 'commands', commands });
  }, []);
  useEffect(() => {
    const engine = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    worker.current = engine;
    engine.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data?.kind !== 'snapshot') return;
      setSnapshot(ev.data.snapshot);
      if (ev.data.project) setProject(ev.data.project);
      if (ev.data.events.length) setEvents(prev =>
        [...prev, ...ev.data.events.map(e => `Scan ${e.tick}: ${e.detail}`)].slice(-24));
    };
    engine.onerror = () => setClientError('Simulation worker failed. Reload the page to restart the sandbox.');
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) engine.postMessage({ kind: 'commands', commands: [{ k: 'loadProject', project: JSON.parse(saved) }] });
    } catch { setClientError('Saved project could not be read; starting with a blank workspace.'); }
    return () => { engine.terminate(); worker.current = null; };
  }, []);
  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setLocalSave('saved');
    } catch {
      setLocalSave('failed');
      setClientError('Local browser storage is full. Export your project as JSON to keep it.');
    }
  }, [project]);
  const goToStage = (stage: 'build' | 'wire' | 'program' | 'test') => {
    setActiveStage(stage);
    document.getElementById(`sandbox-stage-${stage}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const uniqueId = (prefix: string): string => {
    let id = '';
    do { id = `${prefix}-${nextId.current++}`; }
    while (project?.components.some(c => c.id === id) || project?.wires.some(w => w.id === id));
    return id;
  };
  const place = (kind: ComponentKind, x?: number, y?: number) => {
    const i = project?.components.length ?? 0;
    send([{ k: 'place', id: uniqueId(kind), kind, at: {
      x: Math.max(5, Math.min(CANVAS_W - BOX_W - 5, x ?? 20 + (i % 5) * 205)),
      y: Math.max(5, Math.min(CANVAS_H - 145, y ?? 25 + Math.floor(i / 5) * 175)),
    } }]);
  };
  const move = (id: string, at: { x: number; y: number }) => send([{ k: 'move', id, to: at }]);
  const connect = (terminal: string) => {
    if (!selectedTerminal) { setSelectedTerminal(terminal); return; }
    if (selectedTerminal !== terminal) send([{ k: 'wire', id: uniqueId('wire'), from: selectedTerminal, to: terminal }]);
    setSelectedTerminal(null);
  };
  const layout = () => {
    if (project?.components.length) return;
    setMoveTarget(null);
    const devices: { kind: ComponentKind; x: number; y: number }[] = [
      { kind: 'supply', x: 25, y: 25 }, { kind: 'plc', x: 350, y: 25 },
      { kind: 'contactor', x: 650, y: 25 }, { kind: 'motor', x: 870, y: 25 },
      { kind: 'start', x: 175, y: 245 }, { kind: 'stop', x: 460, y: 245 },
    ];
    send(devices.map((d, i): Command => ({ k: 'place', id: `${d.kind}-${i + 1}`, kind: d.kind, at: { x: d.x, y: d.y } })));
  };
  const layoutSorting = () => {
    if (project?.components.length) return;
    setMoveTarget(null);
    const devices: { kind: ComponentKind; x: number; y: number }[] = [
      { kind: 'supply', x: 25, y: 25 }, { kind: 'plc', x: 315, y: 25 },
      { kind: 'contactor', x: 555, y: 25 }, { kind: 'conveyor', x: 610, y: 280 },
      { kind: 'start', x: 60, y: 245 }, { kind: 'stop', x: 325, y: 245 },
      { kind: 'photoeye', x: 690, y: 380 }, { kind: 'diverter', x: 750, y: 170 },
    ];
    send(devices.map((d, i): Command => ({
      k: 'place', id: `${d.kind}-${i + 1}`, kind: d.kind, at: { x: d.x, y: d.y },
    })));
  };
  const exportProject = () => {
    if (!project) return;
    const file = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url; link.download = 'efo-sandbox-project.json'; link.click();
    URL.revokeObjectURL(url);
  };
  const importProject = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 200000) throw new Error('Project must be under 200 KB');
      const parsed: unknown = JSON.parse(await file.text());
      send([{ k: 'loadProject', project: parsed }]);
      setSelectedTerminal(null); setMoveTarget(null); setSelectedDeviceId(null); setEvents([]); setClientError(null);
    } catch (e) { setClientError(e instanceof Error ? e.message : 'Project import failed'); }
    ev.target.value = '';
  };
  const editable = !snapshot?.running;
  const selectedDevice = project?.components.find(c => c.id === selectedDeviceId) ?? null;
  const visibleKinds = componentKinds.filter(kind => {
    const definition = COMPONENTS[kind];
    const words = `${definition.kind} ${definition.label} ${definition.help}`.toLowerCase();
    return words.includes(libraryQuery.trim().toLowerCase());
  });
  const workflow = [
    { id: 'build' as const, label: 'Build', hint: 'Place equipment', count: project?.components.length ?? 0 },
    { id: 'wire' as const, label: 'Wire', hint: 'Connect terminals', count: project?.wires.length ?? 0 },
    { id: 'program' as const, label: 'Program', hint: 'Edit Ladder logic', count: project?.program.rungs.length ?? 0 },
    { id: 'test' as const, label: 'Test', hint: 'Run and troubleshoot', count: snapshot?.tick ?? 0 },
  ];
  return <>
    <AppHeader right={<div className="sandbox-header-links"><Link to="/trades">Exercises</Link><Link to="/employer">Assessment</Link></div>} />
    <main id="main" className="sandbox-page sandbox-ux wrap wrap-wide">
      <header className="sandbox-masthead">
        <div>
          <p className="sandbox-breadcrumb"><Link to="/">Skills Lab</Link><span>/</span> Simulator <span>/</span> Open workspace</p>
          <span className="eyebrow">3D engineering workbench · UX preview</span>
          <h1>Design. Wire. Program. Run.</h1>
          <p className="sandbox-masthead-lede">Create an industrial control circuit in 3D, program its PLC, and see exactly what your logic does.</p>
        </div>
        <div className="sandbox-project-meta" role="status" aria-live="polite">
          <span className={`sandbox-work-status ${snapshot?.running ? 'is-running' : ''}`}>
            <i aria-hidden="true" />{snapshot?.running ? 'SIMULATION RUNNING' : 'EDIT MODE'}
          </span>
          <strong>{project?.components.some(c => c.kind === 'conveyor') ?
            'Untitled conveyor sorting project' : 'Untitled motor-control project'}</strong>
          <small>{localSave === 'saved' ? 'Saved in this browser' :
            localSave === 'failed' ? 'Not saved — export your JSON' : 'Loading local project'}</small>
        </div>
      </header>
      <nav className="sandbox-workflow" aria-label="Sandbox workflow shortcuts">
        {workflow.map((step, index) => <button type="button" key={step.id}
          onClick={() => goToStage(step.id)} aria-pressed={activeStage === step.id}
          className={activeStage === step.id ? 'active' : ''}>
          <span className="sandbox-workflow-number">{String(index + 1).padStart(2, '0')}</span>
          <span><strong>{step.label}</strong><small>{step.hint}</small></span>
          <span className="sandbox-workflow-count">{step.count}</span>
        </button>)}
      </nav>
      <div className="sandbox-toolbar">
        <button className="btn ghost small" onClick={() => { setSelectedTerminal(null); setMoveTarget(null); setSelectedDeviceId(null); setActiveStage('build'); send([{ k: 'clear' }]); }} disabled={!editable}>New blank project</button>
        <button className="btn ghost small" onClick={layout} disabled={!editable || !!project?.components.length}>Place starter layout</button>
        <button className="btn ghost small" onClick={layoutSorting}
          disabled={!editable || !!project?.components.length}>Place 3D sorting layout</button>
        <button className="btn ghost small" onClick={exportProject}>Export JSON</button>
        <button className="btn ghost small" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importProject} />
        <span className="sandbox-toolbar-spacer" />
        <button className="btn ghost small" onClick={() => send([{ k: 'reset' }])}>Reset scan state</button>
        <button className="btn ghost small" onClick={() => send([{ k: 'step' }])} disabled={!editable}>Step scan</button>
        <button className="btn primary small" onClick={() => send([{ k: snapshot?.running ? 'pause' : 'run' }])}>
          {snapshot?.running ? 'Pause' : '▶ Run'}</button>
        <span className="sandbox-scan" aria-live="off">Scan {snapshot?.tick ?? 0}</span>
      </div>
      {(clientError || snapshot?.lastError) && <div role="alert" className="sandbox-alert">{clientError || snapshot?.lastError}</div>}
      <div className="sandbox-layout">
        <aside className="sandbox-palette panel" aria-label="Component library">
          <div className="sandbox-rail-heading"><span className="eyebrow">Device library</span><h2>Components</h2>
            <small>{visibleKinds.length} types available</small></div>
          <label className="sandbox-library-search">
            <span>Find equipment</span>
            <input type="search" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)}
              placeholder="Search motors, PLCs…" aria-label="Search component library" />
          </label>
          <p className="sandbox-library-help">Drag into the 3D floor or select a device to place it. Edits pause while the PLC runs.</p>
          <div className="sandbox-palette-list">
            {visibleKinds.map(kind => <button key={kind} draggable={editable}
              onDragStart={ev => ev.dataTransfer.setData('text/plain', `add:${kind}`)}
              onClick={() => place(kind)} disabled={!editable}
              className="sandbox-palette-item">
              <span className={`sandbox-device-glyph kind-${kind}`} aria-hidden="true">
                {kind === 'plc' ? 'PLC' : kind === 'supply' ? '24V' : kind === 'motor' ? 'M' :
                  kind === 'conveyor' ? 'BELT' : kind === 'photoeye' ? 'EYE' :
                  kind === 'diverter' ? 'DIV' : kind === 'contactor' ? 'K' : kind === 'start' ? 'I' : 'O'}
              </span>
              <span><strong>{COMPONENTS[kind].label}</strong><small>{COMPONENTS[kind].help}</small></span>
              <span className="sandbox-add-device" aria-hidden="true">+</span>
            </button>)}
            {!visibleKinds.length && <p className="sandbox-help" role="status">No devices match your search. Try “motor” or “PLC”.</p>}
          </div>
          <div className="sandbox-library-foot"><strong>Learning scope</strong><span>24V DC · one PLC · educational simulation</span></div>
        </aside>
        <div className="sandbox-main" id="sandbox-stage-build">
          <div className="sandbox-scene-heading"><div><span className="eyebrow">Factory floor</span><h2>3D workspace</h2></div>
            <div><span className="sandbox-scene-stat">{project?.components.length ?? 0} devices</span><span className="sandbox-scene-stat">{project?.wires.length ?? 0} wires</span></div></div>
          <Suspense fallback={<div className="sandbox-3d-loading" role="status">Loading the interactive 3D workbench…</div>}>
            {project && snapshot && <Sandbox3D
              project={project} snapshot={snapshot} editable={editable}
              selectedTerminal={selectedTerminal} moveTarget={moveTarget}
              selectedDeviceId={selectedDeviceId} onSelectDevice={setSelectedDeviceId}
              onTerminal={connect}
              onOperate={(id, pressed) => send([{ k: 'operate', id, pressed }])}
              onPlace={(kind, at) => place(kind, at.x, at.y)}
              onMove={move} onMoveFinished={() => setMoveTarget(null)}
            />}
          </Suspense>
          {!project?.components.length && <div className="sandbox-3d-empty">
            <strong>Start with an empty 3D factory workbench.</strong>
            <span>Place and wire your own devices or load the starter equipment (without pre-wiring).</span>
            <button className="btn ghost small" onClick={layout}>Place starter layout</button>
          </div>}
          <details id="sandbox-stage-wire" className="sandbox-patch panel" open>
            <summary>Component wiring &amp; keyboard controls · {project?.components.length ?? 0} devices</summary>
            <p className="sandbox-help">These controls access the same terminals and states shown in the 3D workbench. Use them on phones, with a keyboard, or when WebGL is unavailable.</p>
            <div className="sandbox-device-list">
              {project?.components.map(c => {
                const def = COMPONENTS[c.kind];
                const live = c.kind === 'conveyor' ? snapshot?.conveyorOn :
                  c.kind === 'photoeye' ? snapshot?.io.Photoeye :
                  c.kind === 'diverter' ? snapshot?.diverterOn :
                  c.kind === 'motor' ? snapshot?.motorOn : c.kind === 'contactor' ? snapshot?.contactorOn :
                  c.kind === 'plc' ? snapshot?.io.PlcPowered : c.kind === 'start' || c.kind === 'stop' ? c.pressed : false;
                return <section className={`sandbox-device ${live ? 'active' : ''}`} key={c.id} data-device-id={c.id}>
                  <div className="sandbox-patch-head">
                    <button type="button" className="sandbox-inspect-link" onClick={() => setSelectedDeviceId(c.id)}
                      aria-label={`Inspect ${def.label}`}>{def.label}</button>
                    <span className="sandbox-device-status">{c.kind === 'motor' ? (live ? 'RUNNING' : 'STOPPED') :
                      c.kind === 'contactor' ? (live ? 'COIL ON' : 'COIL OFF') :
                      c.kind === 'plc' ? (live ? 'POWER OK' : 'NO POWER') :
                      c.kind === 'conveyor' ? (live ? 'BELT MOVING' : 'BELT STOPPED') :
                      c.kind === 'photoeye' ? (live ? 'MARK DETECTED' : 'NO MARK') :
                      c.kind === 'diverter' ? (live ? 'REJECT ACTIVE' : 'PASS') :
                      c.kind === 'supply' ? '24V DC' : c.pressed ? 'PRESSED' : 'RELEASED'}</span>
                  </div>
                  <div className="sandbox-patch-actions">
                    {(c.kind === 'start' || c.kind === 'stop') && <button
                      className={`sandbox-operate ${c.pressed ? 'pressed' : ''}`}
                      onClick={() => send([{ k: 'operate', id: c.id, pressed: !c.pressed }])}>
                        {c.pressed ? 'Release' : 'Press'}</button>}
                    <button type="button" className="sandbox-position" disabled={!editable}
                      aria-label={`Move ${def.label} in 3D`}
                      onClick={() => { setMoveTarget(c.id); setSelectedDeviceId(c.id); }}>Move in 3D</button>
                  </div>
                  <div className="sandbox-patch-terminals">
                    {def.terminals.map(t => {
                      const id = `${c.id}.${t.name}`;
                      return <button key={id} type="button"
                        className={`sandbox-terminal ${selectedTerminal === id ? 'selected' : ''}`}
                        data-terminal-id={id} title={id} aria-label={`Connect ${id}`}
                        disabled={!editable} onClick={() => connect(id)}>{t.name}</button>;
                    })}
                  </div>
                </section>;
              })}
            </div>
          </details>
          <div className="sandbox-status panel">
            <div><span className="eyebrow">Live I/O</span><div className="sandbox-lamps">
              {(['Start', 'StopOK', 'Photoeye', 'Run', 'Sort', 'Q0.0', 'Q0.1', 'PlcPowered'] as const).map(k =>
                <span className={snapshot?.io[k] ? 'lit' : ''} key={k}><i />{k}</span>)}
              </div></div>
            <div><span className="eyebrow">Plant</span>
              <p>Contactor: <strong>{snapshot?.contactorOn ? 'energised' : 'off'}</strong> · Motor: <strong>{snapshot?.motorOn ? 'running' : 'stopped'}</strong></p>
              {project?.components.some(c => c.kind === 'conveyor') && <p>
                Conveyor: <strong>{snapshot?.conveyorOn ? 'moving' : 'stopped'}</strong> ·
                Mark eye: <strong>{snapshot?.io.Photoeye ? 'detected' : 'clear'}</strong> ·
                Diverter: <strong>{snapshot?.diverterOn ? 'reject' : 'pass'}</strong></p>}</div>
          </div>
          {project?.components.some(c => c.kind === 'conveyor') && snapshot && <section
            className="sandbox-sorting-panel panel" aria-label="Conveyor sorting controls">
            <div className="sandbox-section-head"><div>
              <span className="eyebrow">P3 · material handling</span>
              <h2>Conveyor sorting station</h2></div>
              <span className="status-pill is-idle">Single lane · bounded teaching model</span></div>
            <p className="sandbox-help">Feed one parcel at a time. Marked parcels activate the positioned optical detector;
              plain parcels do not. Your wired Q0.1 diverter determines the actual route.</p>
            <div className="sandbox-actions">
              <button type="button" className="btn ghost small" disabled={!!snapshot.plant.parcel}
                onClick={() => send([{ k:'feedParcel', kind:'marked' }])}>Feed marked parcel</button>
              <button type="button" className="btn ghost small" disabled={!!snapshot.plant.parcel}
                onClick={() => send([{ k:'feedParcel', kind:'plain' }])}>Feed plain parcel</button>
            </div>
            <div className="sandbox-sort-metrics" aria-live="off">
              <span>Current: <strong>{snapshot.plant.parcel ?
                `${snapshot.plant.parcel.kind} · ${Math.round(snapshot.plant.parcel.position * 100)}% · ${snapshot.plant.parcel.route}` :
                'empty'}</strong></span>
              <span>Accepted: <strong data-sort-accepted>{snapshot.plant.accepted}</strong></span>
              <span>Rejected: <strong data-sort-rejected>{snapshot.plant.rejected}</strong></span>
            </div>
            <details><summary>Wiring and logic for the sorting exercise</summary>
              <p className="sandbox-help">{sortingWireGuide}</p></details>
          </section>}
        </div>
        <WorkbenchInspector project={project ?? { formatVersion: 1, components: [], wires: [], program: { id: 'pending', version: '1', rungs: [] } }}
          snapshot={snapshot ?? { tick: 0, running: false, components: [], wires: [],
            io: { Start: false, StopOK: false, Photoeye: false, Run: false, Sort: false,
              'Q0.0': false, 'Q0.1': false, PlcPowered: false },
            voltages: {}, contactorOn: false, motorOn: false, motorAngleRad: 0,
            conveyorOn: false, diverterOn: false,
            plant: { parcel: null, lastParcelId: 0, photoeyeActive: false, accepted: 0, rejected: 0 },
            diagnostics: [], lastError: null, language: 'ladder',
            tagValues: { Start: false, StopOK: false, Photoeye: false, Run: false, Sort: false },
            ladderSteps: [], ladderMemory: {}, breakpointScan: null, breakpointHit: null,
            breakpointTag: null, scanTrace: [] }}
          selectedDevice={selectedDevice} selectedTerminal={selectedTerminal} editable={editable}
          onTerminal={connect} onCancelWire={() => setSelectedTerminal(null)}
          onMove={id => setMoveTarget(id)}
          onOperate={(id, pressed) => send([{ k: 'operate', id, pressed }])}
          onClearSelection={() => setSelectedDeviceId(null)} />
      </div>
      <div className="sandbox-bottom">
        <div id="sandbox-stage-program" className="sandbox-program-dock">
          {project && snapshot && <ProgrammingDock project={project} snapshot={snapshot} disabled={!editable}
            onLadder={program => send([{ k: 'loadProgram', program }])}
            onST={source => send([{ k: 'loadST', source }])}
            onLanguage={language => send([{ k: 'activateLanguage', language }])} />}
        </div>
        <aside id="sandbox-stage-test" className="sandbox-instruments panel">
          {snapshot && <LiveMonitor snapshot={snapshot}
            onBreakpoint={scan => send([{ k: 'breakAtScan', scan }])}
            onTagBreakpoint={breakpoint => send([{ k: 'breakOnTag', breakpoint }])} />}
          <span className="eyebrow">Diagnostics</span><h2>Electrical &amp; event trace</h2>
          <p className="sandbox-help">Click a wire's remove button to break a connection and observe what changes. All values come from the simulator.</p>
          <details><summary>Example wiring map</summary><p>{wireGuide}</p>
            {project?.components.some(c => c.kind === 'conveyor') && <p>{sortingWireGuide}</p>}</details>
          <h3>Wires ({project?.wires.length ?? 0})</h3>
          <div className="sandbox-wire-list">{project?.wires.map(w =>
            <div key={w.id}><code>{w.from} → {w.to}</code>
              <button disabled={!editable} aria-label={`Remove wire ${w.id}`} onClick={() => send([{ k: 'unwire', id: w.id }])}>×</button></div>)}</div>
          {selectedTerminal && <button className="btn ghost small" onClick={() => setSelectedTerminal(null)}>Cancel wire from {selectedTerminal}</button>}
          <h3>Voltage probes (V)</h3>
          <div className="sandbox-volts">{Object.entries(snapshot?.voltages ?? {}).filter(([name]) =>
            name.includes('I0.') || name.includes('Q0.') || name.endsWith('A1')).map(([name, value]) =>
              <div key={name}><code>{name}</code><strong>{value === null ? 'floating' : value ?? '—'}</strong></div>)}</div>
          <h3>Simulation events</h3>
          {snapshot?.diagnostics.map((d, i) => <p className="sandbox-diagnostic" key={i}>{d}</p>)}
          <div className="sandbox-event-list">{events.length ? events.map((e, i) => <p key={i}>{e}</p>) :
            <p className="sandbox-help">No changes recorded yet.</p>}</div>
        </aside>
      </div>
      <p className="sandbox-disclaimer">Educational, simplified 24V DC simulation only. Not safety-rated or a substitute for commissioning. This P3 preview adds a genuine worker-driven 3D conveyor, marked-parcel optical detector and wired diverter with deterministic material routing. The underlying Ladder/ST and 24V circuit models remain educational and bounded; no factory-grade mechanics, automatic object recognition, hardware PLC, certified safety, full IEC coverage or real machinery are claimed.</p>
    </main>
  </>;
}
