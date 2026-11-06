import { useCallback, useEffect, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { COMPONENTS, componentKinds, type ComponentKind } from '../components/registry';
import { AppHeader } from '../ui/AppHeader';
import { LadderEditor } from '../program/LadderEditor';
import type { Command, ProjectFile, RenderSnapshot, WorkerResponse } from '../sim/signals';
import './sandbox.css';

const STORAGE_KEY = 'efo-open-sandbox-project-v1';
const CANVAS_W = 1080, CANVAS_H = 580, BOX_W = 170;
const wireGuide = 'Supply P24 → PLC L+, START A, STOP A, contactor 13. Supply M0 → PLC M, contactor A2, motor M-. START B → PLC I0.0; STOP B → PLC I0.1; PLC Q0.0 → contactor A1; contactor 14 → motor L+.';
function pinPosition(id: string, name: string, project: ProjectFile | null): { x: number; y: number } | null {
  const c = project?.components.find(c => c.id === id);
  const t = c && COMPONENTS[c.kind].terminals.find(t => t.name === name);
  return c && t ? { x: c.x + (t.side === 'right' ? BOX_W : 0), y: c.y + t.y } : null;
}
function wirePath(from: string, to: string, project: ProjectFile | null): string | null {
  const [fromId, ...fromPin] = from.split('.');
  const [toId, ...toPin] = to.split('.');
  const a = pinPosition(fromId, fromPin.join('.'), project);
  const b = pinPosition(toId, toPin.join('.'), project);
  if (!a || !b) return null;
  const bend = Math.max(35, Math.abs(a.x - b.x) * 0.4);
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
}
export function SandboxPage() {
  const [snapshot, setSnapshot] = useState<RenderSnapshot | null>(null);
  const [project, setProject] = useState<ProjectFile | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const canvas = useRef<HTMLDivElement | null>(null);
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
  useEffect(() => { if (project) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch {
    setClientError('Local browser storage is full. Export your project as JSON to keep it.'); } }, [project]);
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
  const drop = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const value = ev.dataTransfer.getData('text/plain');
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left - BOX_W / 2, y = ev.clientY - rect.top - 65;
    if (value.startsWith('add:')) {
      const kind = value.slice(4) as ComponentKind;
      if (kind in COMPONENTS) place(kind, x, y);
    } else if (value.startsWith('move:')) {
      const id = value.slice(5);
      send([{ k: 'move', id, to: { x: Math.max(5, Math.min(CANVAS_W - BOX_W - 5, x)),
        y: Math.max(5, Math.min(CANVAS_H - 145, y)) } }]);
    }
  };
  const connect = (terminal: string) => {
    if (!selectedTerminal) { setSelectedTerminal(terminal); return; }
    if (selectedTerminal !== terminal) send([{ k: 'wire', id: uniqueId('wire'), from: selectedTerminal, to: terminal }]);
    setSelectedTerminal(null);
  };
  const layout = () => {
    if (project?.components.length) return;
    const devices: { kind: ComponentKind; x: number; y: number }[] = [
      { kind: 'supply', x: 25, y: 25 }, { kind: 'plc', x: 350, y: 25 },
      { kind: 'contactor', x: 650, y: 25 }, { kind: 'motor', x: 870, y: 25 },
      { kind: 'start', x: 175, y: 245 }, { kind: 'stop', x: 460, y: 245 },
    ];
    send(devices.map((d, i): Command => ({ k: 'place', id: `${d.kind}-${i + 1}`, kind: d.kind, at: { x: d.x, y: d.y } })));
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
      setSelectedTerminal(null); setEvents([]); setClientError(null);
    } catch (e) { setClientError(e instanceof Error ? e.message : 'Project import failed'); }
    ev.target.value = '';
  };
  const editable = !snapshot?.running;
  return <>
    <AppHeader right={<div className="sandbox-header-links"><Link to="/trades">Exercises</Link><Link to="/employer">Assessment</Link></div>} />
    <main id="main" className="sandbox-page wrap wrap-wide">
      <div className="sandbox-section-head sandbox-title">
        <div><span className="eyebrow">EFO Skill Lab · P0/P1 development preview</span>
          <h1>Open automation sandbox</h1>
          <p>Build, connect, program and test an actual simulated 24V motor control circuit.</p></div>
        <span className="status-pill is-idle">Offline-first · no account</span>
      </div>
      <div className="sandbox-toolbar">
        <button className="btn ghost small" onClick={() => send([{ k: 'clear' }])} disabled={!editable}>New blank project</button>
        <button className="btn ghost small" onClick={layout} disabled={!editable || !!project?.components.length}>Place starter layout</button>
        <button className="btn ghost small" onClick={exportProject}>Export JSON</button>
        <button className="btn ghost small" onClick={() => fileInput.current?.click()}>Import JSON</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importProject} />
        <span className="sandbox-toolbar-spacer" />
        <button className="btn ghost small" onClick={() => send([{ k: 'reset' }])}>Reset scan state</button>
        <button className="btn ghost small" onClick={() => send([{ k: 'step' }])} disabled={!editable}>Step scan</button>
        <button className="btn primary small" onClick={() => send([{ k: snapshot?.running ? 'pause' : 'run' }])}>
          {snapshot?.running ? 'Pause' : '▶ Run'}</button>
        <span className="sandbox-scan">Scan {snapshot?.tick ?? 0}</span>
      </div>
      {(clientError || snapshot?.lastError) && <div role="alert" className="sandbox-alert">{clientError || snapshot?.lastError}</div>}
      <div className="sandbox-layout">
        <aside className="sandbox-palette panel" aria-label="Component library">
          <span className="eyebrow">Components</span>
          <h2>Device library</h2>
          <p className="sandbox-help">Drag an item onto the workspace or click to add it. Click two terminals to connect a wire.</p>
          {componentKinds.map(kind => <button key={kind} draggable={editable}
            onDragStart={ev => ev.dataTransfer.setData('text/plain', `add:${kind}`)}
            onClick={() => place(kind)} disabled={!editable}
            className="sandbox-palette-item"><strong>{COMPONENTS[kind].label}</strong>
            <small>{COMPONENTS[kind].help}</small></button>)}
        </aside>
        <div className="sandbox-main">
          <div className="sandbox-canvas-scroll" aria-label="Scrollable workspace">
            <div ref={canvas} className="sandbox-canvas" onDragOver={e => e.preventDefault()} onDrop={drop}>
              <svg className="sandbox-wires" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} aria-hidden="true">
                {project?.wires.map(w => {
                  const d = wirePath(w.from, w.to, project);
                  const energized = snapshot?.voltages[w.from] === 24 && snapshot?.voltages[w.to] === 24;
                  return d && <path key={w.id} d={d} className={energized ? 'live-wire' : ''} />;
                })}
              </svg>
              {!project?.components.length && <div className="sandbox-empty">
                <h2>Your workspace is empty</h2>
                <p>Choose a device on the left, wire its terminals, then edit the Ladder program below. The simulator obeys your wiring and code, including mistakes.</p>
                <button className="btn primary small" onClick={layout}>Place starter layout</button>
              </div>}
              {project?.components.map(c => {
                const def = COMPONENTS[c.kind];
                const live = c.kind === 'motor' ? snapshot?.motorOn : c.kind === 'contactor' ? snapshot?.contactorOn :
                  c.kind === 'plc' ? snapshot?.io.PlcPowered : c.kind === 'start' || c.kind === 'stop' ? c.pressed : false;
                return <div key={c.id} className={`sandbox-device ${live ? 'active' : ''}`}
                  style={{ left: c.x, top: c.y }} draggable={editable}
                  onDragStart={ev => ev.dataTransfer.setData('text/plain', `move:${c.id}`)}>
                  <span className="sandbox-device-kind">{c.kind.toUpperCase()}</span>
                  <strong>{def.label}</strong>
                  {(c.kind === 'start' || c.kind === 'stop') ?
                    <button className={`sandbox-operate ${c.pressed ? 'pressed' : ''}`}
                      onClick={() => send([{ k: 'operate', id: c.id, pressed: !c.pressed }])}>
                      {c.pressed ? 'Release' : 'Press'}</button> :
                    <span className="sandbox-device-status">{c.kind === 'motor' ? (live ? 'RUNNING' : 'STOPPED') :
                      c.kind === 'contactor' ? (live ? 'COIL ON' : 'COIL OFF') :
                      c.kind === 'plc' ? (live ? 'POWER OK' : 'NO POWER') : '24V DC'}</span>}
                  {def.terminals.map(t => {
                    const id = `${c.id}.${t.name}`;
                    return <button key={id} type="button"
                      className={`sandbox-terminal ${t.side} ${selectedTerminal === id ? 'selected' : ''}`}
                      style={{ top: t.y - 10 }} title={id} aria-label={`Connect ${id}`}
                      disabled={!editable} onClick={() => connect(id)}>{t.name}</button>;
                  })}
                </div>;
              })}
            </div>
          </div>
          <div className="sandbox-status panel">
            <div><span className="eyebrow">Live I/O</span><div className="sandbox-lamps">
              {(['Start', 'StopOK', 'Run', 'Q0.0', 'PlcPowered'] as const).map(k =>
                <span className={snapshot?.io[k] ? 'lit' : ''} key={k}><i />{k}</span>)}
              </div></div>
            <div><span className="eyebrow">Plant</span>
              <p>Contactor: <strong>{snapshot?.contactorOn ? 'energised' : 'off'}</strong> · Motor: <strong>{snapshot?.motorOn ? 'running' : 'stopped'}</strong></p></div>
          </div>
        </div>
      </div>
      <div className="sandbox-bottom">
        {project && snapshot && <LadderEditor document={project.program} snapshot={snapshot}
          disabled={!editable} onChange={program => send([{ k: 'loadProgram', program }])} />}
        <aside className="sandbox-instruments panel">
          <span className="eyebrow">Diagnostics</span><h2>Electrical &amp; event trace</h2>
          <p className="sandbox-help">Click a wire's remove button to break a connection and observe what changes. All values come from the simulator.</p>
          <details><summary>Example wiring map</summary><p>{wireGuide}</p></details>
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
      <p className="sandbox-disclaimer">Educational, simplified 24V DC simulation only. Not safety-rated or a substitute for real equipment commissioning. This P1 preview implements one PLC, one supply, a Ladder rung, a contactor and a DC motor; full 3D, FBD, more devices and advanced electrical fidelity remain future phases.</p>
    </main>
  </>;
}
