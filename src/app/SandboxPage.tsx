import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { COMPONENTS, componentKinds, isPlcKind, type ComponentKind } from '../components/registry';
import { IoMappingPanel } from '../ui/sandbox/IoMappingPanel';
import { LogicalWiringCanvas } from '../ui/sandbox/LogicalWiringCanvas';
import { PlantScenePanel } from '../ui/sandbox/PlantScenePanel';
import { freshWorld } from '../plant/world/bodies';
import { AppHeader } from '../ui/AppHeader';
import { ProgrammingDock } from '../program/ProgrammingDock';
import { LiveMonitor } from '../program/LiveMonitor';
import { WorkbenchInspector } from '../ui/sandbox/WorkbenchInspector';
import {DEVICE_FAMILIES,matchesFamily,supportedFamilies,type DeviceFamily} from '../ui/sandbox/workspace-catalog';
import { TroubleshootingPanel } from '../ui/sandbox/TroubleshootingPanel';
import { ScenarioPanel } from '../ui/sandbox/ScenarioPanel';
import { perDeviceLive } from '../sim/device-state';
import { plcComponents, programOf } from '../sim/plcs';
import { vesselsOf } from '../sim/stations';
import { appendEvidence, evidenceFromCommand } from '../exercises/evidence';
import { scenarioStorageKey, type ScenarioRequest, type ScenarioSession } from '../exercises/session';
import { getScenario } from '../exercises/catalogue';
import type { AttemptResult, EvidenceEvent, RubricResult } from '../platform/types';
import type { Command, ProjectFile, RenderSnapshot, WorkerResponse } from '../sim/signals';
import './sandbox.css';
import './p5-workspace.css';

const Sandbox3D = lazy(() => import('../render/Sandbox3D').then(module => ({ default: module.Sandbox3D })));
const STORAGE_KEY = 'efo-open-sandbox-project-v1';
const CANVAS_W = 1080, CANVAS_H = 580, BOX_W = 170;
const wireGuide = 'Supply P24 → PLC L+, START A, STOP A, contactor 13. Supply M0 → PLC M, contactor A2, motor M-. START B → PLC I0.0; STOP B → PLC I0.1; PLC Q0.0 → contactor A1; contactor 14 → motor L+.';
const twoPanelWireGuide = 'Each panel is wired like the single starter, from its own supply: P24 → PLC L+, START A, STOP A, contactor 13; M0 → PLC M, contactor A2, motor M-; START B → I0.0; STOP B → I0.1; PLC Q0.0 → contactor A1; contactor 14 → motor L+. Panel 2 uses supply-2, plc-2, start-2, stop-2, contactor-2 and motor-2. To make one panel depend on another, tie the two supplies\' M0 terminals together (a shared common) and wire one PLC\'s output (for example plc-1 Q0.0) to the other PLC\'s input (plc-2 I0.0). Without a shared common, two supplies are isolated and no signal can cross. Select a PLC (click it, or use its tab above the editor) to program it separately.';
const sortingWireGuide = 'For 3D sorting: supply P24 → PLC L+, START A, STOP A, contactor 13, photoeye L+. Supply M0 → PLC M, contactor A2, conveyor M-, photoeye M, diverter A2. START B → I0.0; STOP B → I0.1; PLC Q0.0 → contactor A1; contactor 14 → conveyor L+. Photoeye OUT → PLC I0.2; PLC Q0.1 → diverter A1. Load the sorting Ladder example, Run, press START, and feed marked or plain parcels. Photoeye and diverter must be positioned alongside the conveyor in sensor→diverter order.';
const tankWireGuide = 'For tank process: P24 to PLC L+, STOP A and level probe L+. M0 to PLC M, pump M-, level probe M and drain valve A2. STOP B to PLC I0.1; level probe OUT to PLC I0.3; PLC Q0.2 to pump L+; PLC Q0.3 to drain valve A1. Mount the pump, probe and valve near the tank. Load the tank control Ladder example, Run and observe filling to 750 ml, switching and drainage until 600 ml. Wrong PLC logic, miswiring or moving equipment alters the real result.';
const protectedDOLGuide = 'Protected DOL training circuit (16 wires): supply P24 → breaker IN; breaker OUT → E-stop A; E-stop B → PLC L+, START A, STOP A and contactor 13. Supply M0 → PLC M, contactor A2, motor M- and pilot lamp M-. START B → PLC I0.0; STOP B → PLC I0.1; PLC Q0.0 → overload 95; overload 96 → contactor A1; contactor 14 → motor L+ and lamp L+. Load editable latch program. Press E-stop to open the upstream NC supply path (training demonstration, NOT a certified safety function), reset it manually. Trip overload to open coil path. For a breaker short demo, wire breaker OUT directly to supply M0, Run or Step to trip; remove that wire before reset. Use meter probes to compare actual net potentials.';
const reverseWireGuide = 'P4 forward/reverse (21 wires): supply P24 → breaker IN; breaker OUT → E-stop A; E-stop B → PLC L+, START A, REVERSE A, STOP A, forward contactor 13, reverse contactor 13. Supply M0 → PLC M, both contactor A2 and reversible motor M-. START B → PLC I0.0; REVERSE B → PLC I0.4; STOP B → PLC I0.1. PLC Q0.4 → reverse contactor NC 21; reverse NC 22 → forward A1. PLC Q0.5 → forward NC 21; forward NC 22 → reverse A1. Forward contactor 14 → motor F+; reverse contactor 14 → motor R+. Load forward/reverse Ladder example and Run; press/release START to latch forward, STOP then press/release REVERSE to latch reverse. Pressing both requests together is rejected by example logic. Miswire or bypass NC contacts to observe actual electrical/mechanical interlock warnings. Educational 24V direction-input model, NOT three-phase reversing wiring or safety-certified machinery.';
/**
 * The open sandbox. With a `scenario` it becomes the P6 exercise/assessment workbench: the same
 * worker, the same 3D scene and the same tools, plus a work order, the scenario's starter project,
 * an evidence trail and a headless outcome grader. Answer-revealing helpers are hidden.
 */
export function SandboxPage({ scenario: request }: { scenario?: ScenarioRequest } = {}) {
  // Resolved here, inside the lazy workbench chunk, so linking pages stay light.
  const scenario = useMemo<ScenarioSession | undefined>(() => {
    const def = request ? getScenario(request.scenarioId) : undefined;
    if (!request || !def) return undefined;
    const { scenarioId: _id, ...rest } = request;
    return { ...rest, def };
  }, [request]);
  const [snapshot, setSnapshot] = useState<RenderSnapshot | null>(null);
  const [project, setProject] = useState<ProjectFile | null>(null);
  // Undo for destructive edits (remove / add panel): the project as it was before each one that took effect.
  const projectRef = useRef<ProjectFile | null>(null);
  const pendingUndo = useRef<ProjectFile | null>(null);
  const [undoStack, setUndoStack] = useState<ProjectFile[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPlcId, setSelectedPlcId] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  // View/panel preferences do not belong to PLC or electrical project state.
  const [libraryFamily,setLibraryFamily] = useState<DeviceFamily>('all');
  const [workspaceView,setWorkspaceView] = useState<'physical'|'logical'>('physical');
  const [libraryExpanded,setLibraryExpanded] = useState(true);
  const [inspectorExpanded,setInspectorExpanded] = useState(true);
  const [dockExpanded,setDockExpanded] = useState(true);
  const [dockFocus,setDockFocus] = useState<'program'|'diagnostics'>('program');
  const [workspaceHelp,setWorkspaceHelp] = useState(false);
  const [activeStage, setActiveStage] = useState<'build' | 'wire' | 'program' | 'test'>('build');
  const [localSave, setLocalSave] = useState<'pending' | 'saved' | 'failed'>('pending');
  const [events, setEvents] = useState<string[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const nextId = useRef(1);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const storageKey = scenario ? scenarioStorageKey(scenario) : STORAGE_KEY;
  const attemptKey = `${storageKey}:attempt`;
  const [evidence, setEvidence] = useState<EvidenceEvent[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const resultRef = useRef<AttemptResult | null>(null);
  const startedAt = useRef(0);
  const send = useCallback((commands: Command[]) => {
    if (scenario && resultRef.current) return; // a submitted attempt is frozen
    if (scenario) {
      const at = Date.now() - startedAt.current;
      setEvidence(prev => commands.reduce((log, c) => {
        const e = evidenceFromCommand(c);
        return e ? appendEvidence(log, at, e.action, e.detail) : log;
      }, prev));
    }
    if (commands.some(c => c.k === 'remove' || c.k === 'addPanel')) pendingUndo.current = projectRef.current;
    worker.current?.postMessage({ kind: 'commands', commands });
  }, [scenario]);
  useEffect(() => {
    const engine = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    worker.current = engine;
    engine.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data?.kind !== 'snapshot') return;
      setSnapshot(ev.data.snapshot);
      if (pendingUndo.current) {
        // The worker answered the destructive command: keep an undo point only if it actually changed the project.
        const before = pendingUndo.current;
        pendingUndo.current = null;
        if (ev.data.project) setUndoStack(stack => [...stack.slice(-9), before]);
      }
      if (ev.data.project) { projectRef.current = ev.data.project; setProject(ev.data.project); }
      if (scenario) {
        // Repairs are recorded from the worker's own events, so a rejected attempt is never counted.
        const repairs = ev.data.events.filter(e => e.kind === 'repair');
        if (repairs.length) setEvidence(prev => repairs.reduce(
          (log, e) => appendEvidence(log, Date.now() - startedAt.current, 'repair', e.detail), prev));
      }
      if (ev.data.events.length) setEvents(prev =>
        [...prev, ...ev.data.events.map(e => `Scan ${e.tick}: ${e.detail}`)].slice(-24));
    };
    engine.onerror = () => setClientError('Simulation worker failed. Reload the page to restart the sandbox.');
    startedAt.current = Date.now();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) engine.postMessage({ kind: 'commands', commands: [{ k: 'loadProject', project: JSON.parse(saved) }] });
      else if (scenario) engine.postMessage({ kind: 'commands', commands: [
        { k: 'loadProject', project: scenario.def.starter(scenario.seed) }] });
      if (scenario) {
        const attempt = localStorage.getItem(attemptKey);
        if (attempt) {
          const parsed = JSON.parse(attempt) as { startedAt: number; evidence: EvidenceEvent[]; result: AttemptResult | null };
          startedAt.current = parsed.startedAt;
          setEvidence(parsed.evidence);
          resultRef.current = parsed.result;
          setResult(parsed.result);
        }
      }
    } catch { setClientError('Saved project could not be read; starting with a blank workspace.'); }
    return () => { engine.terminate(); worker.current = null; };
  }, []);
  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(project));
      setLocalSave('saved');
    } catch {
      setLocalSave('failed');
      setClientError('Local browser storage is full. Export your project as JSON to keep it.');
    }
  }, [project, storageKey]);
  useEffect(() => {
    if (!scenario || !project) return;
    try { localStorage.setItem(attemptKey, JSON.stringify({ startedAt: startedAt.current, evidence, result })); }
    catch { /* the attempt just will not survive a reload */ }
  }, [scenario, project, evidence, result, attemptKey]);
  const submitScenario = (rubric: RubricResult) => {
    if (!scenario || resultRef.current || !project) return;
    const finishedAt = Date.now();
    worker.current?.postMessage({ kind: 'commands', commands: [{ k: 'pause' }] });
    const attempt: AttemptResult = {
      kind: 'skills-lab-result', formatVersion: 1,
      assignment: scenario.assignment ?? {
        kind: 'skills-lab-assignment', formatVersion: 1, trade: scenario.def.trade, exerciseId: scenario.def.id,
        exerciseVersion: scenario.def.version, mode: scenario.mode, seed: scenario.seed,
        createdAt: new Date(startedAt.current).toISOString(),
      },
      startedAt: new Date(startedAt.current).toISOString(), finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - startedAt.current, evidence, rubric,
    };
    resultRef.current = attempt;
    setResult(attempt);
    scenario.onSubmitted?.(attempt);
  };
  const restartScenario = () => {
    if (!scenario || !scenario.allowRestart) return;
    if (scenario.onRestart) {
      // Start a brand-new attempt: forget this one and let the page remount with a fresh seed.
      try { localStorage.removeItem(storageKey); localStorage.removeItem(attemptKey); } catch { /* nothing stored */ }
      scenario.onRestart();
      return;
    }
    resultRef.current = null;
    setResult(null);
    setEvidence([]);
    startedAt.current = Date.now();
    setSelectedTerminal(null); setMoveTarget(null); setSelectedDeviceId(null); setEvents([]); setClientError(null);
    worker.current?.postMessage({ kind: 'commands', commands: [
      { k: 'loadProject', project: scenario.def.starter(scenario.seed) }, { k: 'reset' }] });
  };
  const goToStage = (stage: 'build' | 'wire' | 'program' | 'test') => {
    setActiveStage(stage);
    if(stage==='build')setWorkspaceView('physical');
    if(stage==='wire')setWorkspaceView('logical');
    if(stage==='program'||stage==='test'){
      setDockExpanded(true);
      setDockFocus(stage==='program'?'program':'diagnostics');
    }
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
  /** Two complete, unwired starter panels side by side: each with its own supply, PLC, buttons, contactor and motor. */
  const layoutTwoPanels = () => {
    if (project?.components.length) return;
    setMoveTarget(null);
    const columns = [10, 185, 360];
    const rows = [10, 150];
    const panel = (n: number, dx: number): Command[] => ([
      ['supply', 0, 0], ['plc', 1, 0], ['contactor', 2, 0], ['start', 0, 1], ['stop', 1, 1], ['motor', 2, 1],
    ] as const).map(([kind, col, row]): Command => ({
      k: 'place', id: `${kind}-${n}`, kind, at: { x: dx + columns[col], y: rows[row] } }));
    send([...panel(1, 0), ...panel(2, 535)]);
  };
  const layoutTank = () => {
    if (project?.components.length) return;
    setMoveTarget(null);
    const devices: { kind: ComponentKind; x: number; y: number }[] = [
      { kind: 'supply', x: 25, y: 25 }, { kind: 'plc', x: 310, y: 25 },
      { kind: 'stop', x: 225, y: 245 }, { kind: 'tank', x: 680, y: 290 },
      { kind: 'pump', x: 525, y: 280 }, { kind: 'levelprobe', x: 700, y: 360 },
      { kind: 'drainvalve', x: 840, y: 360 },
    ];
    send(devices.map((d, i): Command => ({
      k: 'place', id: `${d.kind}-${i + 1}`, kind: d.kind, at: { x: d.x, y: d.y },
    })));
  };
  const layoutProtectedDOL = () => {
    if (project?.components.length) return;
    setMoveTarget(null);
    const devices: { kind: ComponentKind; x: number; y: number }[] = [
      {kind:'supply',x:25,y:25}, {kind:'breaker',x:175,y:25},
      {kind:'estop',x:160,y:245}, {kind:'plc',x:345,y:25},
      {kind:'start',x:35,y:400}, {kind:'stop',x:285,y:245},
      {kind:'overload',x:510,y:245}, {kind:'contactor',x:605,y:25},
      {kind:'motor',x:855,y:25}, {kind:'lamp',x:815,y:245},
    ];
    send(devices.map((d,i):Command=>({k:'place',id:`${d.kind}-${i+1}`,kind:d.kind,
      at:{x:d.x,y:d.y}})));
  };
  const layoutReverser = () => {
    if (project?.components.length) return;
    setMoveTarget(null);
    const devices: { kind: ComponentKind; x: number; y: number }[] = [
      {kind:'supply',x:25,y:25}, {kind:'breaker',x:175,y:25},
      {kind:'estop',x:130,y:245}, {kind:'plc',x:350,y:25},
      {kind:'start',x:25,y:405}, {kind:'reversebutton',x:250,y:405},
      {kind:'stop',x:340,y:245}, {kind:'forwardcontactor',x:595,y:25},
      {kind:'reversecontactor',x:595,y:245}, {kind:'revmotor',x:875,y:25},
    ];
    send(devices.map((d,i):Command=>({k:'place',id:`${d.kind}-${i+1}`,kind:d.kind,
      at:{x:d.x,y:d.y}})));
  };
  const meterTerminals = project?.components.flatMap(c =>
    COMPONENTS[c.kind].terminals.map(t => `${c.id}.${t.name}`)) ?? [];
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
  // Several PLCs: the programming dock, live I/O lamps and monitor follow the selected PLC.
  const plcList = project ? plcComponents(project) : [];
  const activePlcId = plcList.find(c => c.id === selectedPlcId)?.id ?? plcList[0]?.id;
  const activePlcView = activePlcId ? snapshot?.plcs[activePlcId] : undefined;
  const dockProject = project && activePlcId ? { ...project, ...programOf(project, activePlcId) } : project;
  const dockSnapshot = snapshot && activePlcView ? { ...snapshot, language: activePlcView.language,
    tagValues: activePlcView.tagValues, ladderSteps: activePlcView.ladderSteps, ladderMemory: activePlcView.ladderMemory } : snapshot;
  const activeIo: Record<string, boolean> = { ...(snapshot?.io ?? {}), ...(activePlcView ? {
    ...activePlcView.inputs, ...activePlcView.coils, ...activePlcView.outputs, PlcPowered: activePlcView.powered } : {}) };
  const selectedDevice = project?.components.find(c => c.id === selectedDeviceId) ?? null;
  const removeDevice = (id: string) => {
    if (selectedDeviceId === id) setSelectedDeviceId(null);
    if (selectedTerminal?.startsWith(`${id}.`)) setSelectedTerminal(null);
    send([{ k: 'remove', id }]);
  };
  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setUndoStack(stack => stack.slice(0, -1));
    setSelectedDeviceId(null); setSelectedTerminal(null); setMoveTarget(null);
    send([{ k: 'loadProject', project: previous }]);
  };
  // The toolbar is sticky: keep it just below the sticky app header, whatever height the header has.
  useEffect(() => {
    const header = document.querySelector('.app-header');
    if (!header) return;
    const apply = () => document.documentElement.style.setProperty('--app-header-h', `${Math.round(header.getBoundingClientRect().height)}px`);
    apply();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null;
    observer?.observe(header);
    window.addEventListener('resize', apply);
    return () => { observer?.disconnect(); window.removeEventListener('resize', apply); document.documentElement.style.removeProperty('--app-header-h'); };
  }, []);
  // Delete removes the selected device (when paused), like a bench tool; never while typing in a field.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Delete' || !selectedDeviceId || snapshot?.running) return;
      const el = ev.target as HTMLElement | null;
      if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
      removeDevice(selectedDeviceId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const selectDevice = (id: string | null) => {
    setSelectedDeviceId(id);
    if (id && isPlcKind(project?.components.find(c => c.id === id)?.kind ?? '')) setSelectedPlcId(id);
  };
  const visibleKinds = componentKinds.filter(kind => {
    const definition = COMPONENTS[kind];
    const words = `${definition.kind} ${definition.label} ${definition.help}`.toLowerCase();
    return matchesFamily(kind,libraryFamily) &&
      words.includes(libraryQuery.trim().toLowerCase());
  });
  const availableFamilies=supportedFamilies(componentKinds);
  const workflow = [
    { id: 'build' as const, label: 'Build', hint: 'Place equipment', count: project?.components.length ?? 0 },
    { id: 'wire' as const, label: 'Wire', hint: 'Connect terminals', count: project?.wires.length ?? 0 },
    { id: 'program' as const, label: 'Program', hint: 'Edit Ladder logic', count: project?.program.rungs.length ?? 0 },
    { id: 'test' as const, label: 'Test', hint: 'Run and troubleshoot', count: snapshot?.tick ?? 0 },
  ];
  // Shortcuts affect only the active view, except explicit export.
  useEffect(()=>{
    const onShortcut=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const typing=!!target&&(/^(input|textarea|select)$/i.test(target.tagName)||target.isContentEditable);
      if(event.key==='Escape'){setSelectedTerminal(null);setMoveTarget(null);return;}
      if(typing||event.repeat)return;
      if(event.altKey&&(event.key==='1'||event.key==='2')){
        event.preventDefault();setWorkspaceView(event.key==='1'?'logical':'physical');
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){
        event.preventDefault();exportProject();
      }
    };
    window.addEventListener('keydown',onShortcut);
    return ()=>window.removeEventListener('keydown',onShortcut);
  });
  return <>
    <AppHeader />
    <main id="main" className="sandbox-page sandbox-ux p5-organized wrap wrap-wide"
      data-p5-workspace="organized">
      <header className="sandbox-masthead">
        <div>
          <p className="sandbox-breadcrumb"><Link to="/">Skills Lab</Link><span>/</span> {scenario ? 'Scenario' : 'Simulator'} <span>/</span> {scenario ? scenario.def.title : 'Open workspace'}</p>
          <span className="eyebrow">{scenario ? 'Scenario workbench · same simulator as the open sandbox' : '3D engineering workbench · UX preview'}</span>
          <h1>Design. Wire. Program. Run.</h1>
          <p className="sandbox-masthead-lede">{scenario ? 'Build, wire, program, run and troubleshoot on the real simulator. The result is graded by what your circuit does.' : 'Create an industrial control circuit in 3D, program its PLC, and see exactly what your logic does.'}</p>
        </div>
        <div className="sandbox-project-meta" role="status" aria-live="polite">
          <span className={`sandbox-work-status ${snapshot?.running ? 'is-running' : ''}`}>
            <i aria-hidden="true" />{snapshot?.running ? 'SIMULATION RUNNING' : 'EDIT MODE'}
          </span>
          <strong>{scenario ? scenario.def.title : plcList.length > 1 ? `Untitled multi-panel project (${plcList.length} PLCs)` : project?.components.some(c => c.kind === 'revmotor') ? 'Untitled forward/reverse motor panel' :
            project?.components.some(c => c.kind === 'breaker') ? 'Untitled protected 24V DOL panel' :
            project?.components.some(c => c.kind === 'tank') ? 'Untitled tank process project' :
            project?.components.some(c => c.kind === 'conveyor') ?
            'Untitled conveyor sorting project' : 'Untitled motor-control project'}</strong>
          <small>{localSave === 'saved' ? 'Saved in this browser' :
            localSave === 'failed' ? 'Not saved — export your JSON' : 'Loading local project'}</small>
        </div>
      </header>
      <nav className="p5-menu-bar" aria-label="Engineering workspace menus" data-p5-menu>
        <details><summary>Project</summary><div className="p5-menu-content">
          {!scenario && <button type="button" disabled={!editable} onClick={()=>{
            setSelectedTerminal(null);setMoveTarget(null);setSelectedDeviceId(null);
            setWorkspaceView('physical');send([{k:'clear'}]);
          }}>New empty project</button>}
          {!scenario && <button type="button" onClick={()=>fileInput.current?.click()}>Open local JSON project</button>}
          <button type="button" disabled={!project} onClick={exportProject}>Download project JSON</button>
          <span>Projects stay in this browser unless exported.</span>
        </div></details>
        <details><summary>Edit</summary><div className="p5-menu-content">
          <button type="button" disabled={!editable||!undoStack.length} onClick={undo}>Undo last destructive edit</button>
          <button type="button" disabled={!editable||!selectedDeviceId}
            onClick={()=>selectedDeviceId&&removeDevice(selectedDeviceId)}>Remove selected device</button>
          <button type="button" onClick={()=>{setSelectedTerminal(null);setMoveTarget(null);}}>Cancel tool/terminal</button>
        </div></details>
        <details><summary>View</summary><div className="p5-menu-content">
          <button type="button" onClick={()=>setWorkspaceView('logical')}>Show logical wiring</button>
          <button type="button" onClick={()=>setWorkspaceView('physical')}>Show physical plant</button>
          <button type="button" onClick={()=>setLibraryExpanded(v=>!v)}>Toggle device library</button>
          <button type="button" onClick={()=>setInspectorExpanded(v=>!v)}>Toggle inspector</button>
          <button type="button" onClick={()=>setDockExpanded(v=>!v)}>Toggle engineering dock</button>
        </div></details>
        <details><summary>Simulation</summary><div className="p5-menu-content">
          <button type="button" onClick={()=>send([{k:snapshot?.running?'pause':'run'}])}>
            {snapshot?.running?'Pause simulation':'Start simulation'}</button>
          <button type="button" disabled={!editable} onClick={()=>send([{k:'step'}])}>Advance one PLC scan</button>
          <button type="button" onClick={()=>send([{k:'reset'}])}>Reset simulated state</button>
        </div></details>
        <details><summary>Tools</summary><div className="p5-menu-content">
          <button type="button" onClick={()=>{setWorkspaceView('logical');setActiveStage('wire');}}>Open terminal wiring</button>
          <button type="button" onClick={()=>{setDockFocus('diagnostics');setDockExpanded(true);}}>Open virtual instruments</button>
          <button type="button" onClick={()=>{setDockFocus('program');setDockExpanded(true);}}>Open PLC programming</button>
        </div></details>
        <details><summary>Help</summary><div className="p5-menu-content">
          <button type="button" onClick={()=>setWorkspaceHelp(v=>!v)}>Toggle workspace instructions</button>
          <span>Alt+1 logical · Alt+2 physical · Ctrl+S export · Esc cancel</span>
        </div></details>
      </nav>
      {workspaceHelp&&<aside className="p5-help" aria-label="Workspace instructions">
        Place supported equipment from the library, connect real terminal pairs in Logical/Wiring,
        edit the selected PLC program, then Run or Step. Both views share one project and one
        authoritative worker. Values are illustrative educational simulations, not field ratings.
      </aside>}
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
        {!scenario && <>
        <button className="btn ghost small" onClick={() => { setSelectedTerminal(null); setMoveTarget(null); setSelectedDeviceId(null); setActiveStage('build'); send([{ k: 'clear' }]); }} disabled={!editable}>New blank project</button>
        {/* The ready-made starters live in one menu so the sticky toolbar stays a single short row. */}
        <details className="sandbox-starters" data-starters>
          <summary className="btn ghost small">Starters</summary>
          <div className="sandbox-starters-menu" role="group" aria-label="Ready-made starters"
            onClick={e => { if ((e.target as HTMLElement).closest('button')) (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; }}>
            <button className="btn ghost small" data-add-panel onClick={() => send([{ k: 'addPanel', template: 'motor-starter' }])}
              disabled={!editable}>Add starter panel</button>
            <button className="btn ghost small" onClick={layout} disabled={!editable || !!project?.components.length}>Place starter layout</button>
            <button className="btn ghost small" onClick={layoutTwoPanels} data-layout-two-panels
              disabled={!editable || !!project?.components.length}>Place two-panel layout</button>
            <button className="btn ghost small" onClick={layoutSorting}
              disabled={!editable || !!project?.components.length}>Place 3D sorting layout</button>
            <button className="btn ghost small" onClick={layoutTank}
              disabled={!editable || !!project?.components.length}>Place 3D tank layout</button>
            <button className="btn ghost small" onClick={layoutProtectedDOL}
              disabled={!editable || !!project?.components.length}>Place protected DOL layout</button>
            <button className="btn ghost small" onClick={layoutReverser}
              disabled={!editable || !!project?.components.length}>Place reversing DOL layout</button>
          </div>
        </details>
        </>}
        <button className="btn ghost small" data-undo onClick={undo}
          disabled={!editable || !undoStack.length}>Undo</button>
        <button className="btn ghost small" onClick={exportProject}>Export JSON</button>
        {!scenario && <button className="btn ghost small" onClick={() => fileInput.current?.click()}>Import JSON</button>}
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importProject} />
        <span className="sandbox-toolbar-spacer" />
        <button className="btn ghost small" onClick={() => send([{ k: 'reset' }])}>Reset scan state</button>
        <button className="btn ghost small" onClick={() => send([{ k: 'step' }])} disabled={!editable}>Step scan</button>
        <button className="btn primary small" onClick={() => send([{ k: snapshot?.running ? 'pause' : 'run' }])}>
          {snapshot?.running ? 'Pause' : '▶ Run'}</button>
        <span className="sandbox-scan" aria-live="off">Scan {snapshot?.tick ?? 0}</span>
      </div>
      <div className="p5-view-tools" role="toolbar" aria-label="Canvas views and active tools">
        <div className="p5-view-tabs" role="group" aria-label="Project view">
          <button type="button" data-p5-view="logical" aria-pressed={workspaceView==='logical'}
            onClick={()=>setWorkspaceView('logical')}>Logical / Wiring</button>
          <button type="button" data-p5-view="physical" aria-pressed={workspaceView==='physical'}
            onClick={()=>setWorkspaceView('physical')}>Physical / 3D Plant</button>
        </div>
        <div className="p5-tool-actions" role="group" aria-label="Engineering tools">
          <button type="button" onClick={()=>{setMoveTarget(null);setSelectedTerminal(null);}}>Select</button>
          <button type="button" disabled={!editable} onClick={()=>{setWorkspaceView('logical');setActiveStage('wire');}}>
            Wire terminals</button>
          <button type="button" onClick={()=>{setDockFocus('diagnostics');setDockExpanded(true);
            document.getElementById('sandbox-stage-test')?.scrollIntoView({block:'nearest'});}}>
            Measure / diagnose</button>
        </div>
        <div className="p5-panel-toggles" role="group" aria-label="Workspace panels">
          <button type="button" aria-pressed={libraryExpanded}
            onClick={()=>setLibraryExpanded(v=>!v)}>Library</button>
          <button type="button" aria-pressed={inspectorExpanded}
            onClick={()=>setInspectorExpanded(v=>!v)}>Inspector</button>
          <button type="button" aria-pressed={dockExpanded}
            onClick={()=>setDockExpanded(v=>!v)}>Dock</button>
        </div>
      </div>
      {(clientError || snapshot?.lastError) && <div role="alert" className="sandbox-alert">{clientError || snapshot?.lastError}</div>}
      {scenario && <ScenarioPanel session={scenario} project={project} evidence={evidence} result={result}
        onSubmit={submitScenario} onRestart={restartScenario} />}
      <div className={`sandbox-layout p5-layout ${!libraryExpanded?'p5-no-library':''} ${!inspectorExpanded?'p5-no-inspector':''}`}
        data-p5-view-active={workspaceView}>
        {libraryExpanded&&<aside className="sandbox-palette panel" aria-label="Component library" data-p5-library>
          <div className="sandbox-rail-heading"><span className="eyebrow">Device library</span><h2>Components</h2>
            <small>{visibleKinds.length} types available</small></div>
          <label className="sandbox-library-search">
            <span>Find equipment</span>
            <input type="search" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)}
              placeholder="Search motors, PLCs…" aria-label="Search component library" />
          </label>
          <div className="p5-device-families" role="group" aria-label="Industrial device families">
            {DEVICE_FAMILIES.filter(f=>availableFamilies.includes(f.id)).map(f=>
              <button key={f.id} type="button" data-p5-category={f.id}
                aria-pressed={libraryFamily===f.id} onClick={()=>setLibraryFamily(f.id)}>
                {f.label}</button>)}
          </div>
          <p className="sandbox-library-help">Drag an available device into the 3D floor,
            or click to place it. The registry determines what really works. Pause to edit.</p>
          <div className="sandbox-palette-list">
            {visibleKinds.map(kind => <button key={kind} draggable={editable}
              onDragStart={ev => ev.dataTransfer.setData('text/plain', `add:${kind}`)}
              onClick={() => place(kind)} disabled={!editable}
              className="sandbox-palette-item">
              <span className={`sandbox-device-glyph kind-${kind}`} aria-hidden="true">
                {kind === 'plc' ? 'PLC' : kind === 'plc16' ? '16/16' : kind === 'relay' ? 'RLY' : kind === 'timerelay' ? 'TDR' : kind === 'cylinder' ? 'CYL' : kind === 'stacklight' ? 'STK' : kind === 'supply' ? '24V' : kind === 'motor' ? 'M' :
                  kind === 'conveyor' ? 'BELT' : kind === 'photoeye' ? 'EYE' :
                  kind === 'diverter' ? 'DIV' : kind === 'tank' ? 'TANK' :
                  kind === 'pump' ? 'PUMP' : kind === 'levelprobe' ? 'LVL' :
                  kind === 'drainvalve' ? 'VAL' : kind === 'estop' ? 'E-STOP' : kind === 'breaker' ? 'CB' :
                  kind === 'overload' ? 'OL' : kind === 'reversebutton' ? 'REV' :
                  kind === 'forwardcontactor' ? 'KF' : kind === 'reversecontactor' ? 'KR' :
                  kind === 'revmotor' ? 'M↔' : kind === 'lamp' ? 'LED' : kind === 'contactor' ? 'K' : kind === 'start' ? 'I' : 'O'}
              </span>
              <span><strong>{COMPONENTS[kind].label}</strong><small>{COMPONENTS[kind].help}</small></span>
              <span className="sandbox-add-device" aria-hidden="true">+</span>
            </button>)}
            {!visibleKinds.length && <p className="sandbox-help" role="status">No devices match your search. Try “motor” or “PLC”.</p>}
          </div>
          <div className="sandbox-library-foot"><strong>Educational models</strong>
            <span>{componentKinds.length} registered kinds · no live equipment</span></div>
        </aside>}
        <div className="sandbox-main" id="sandbox-stage-build">
          <div className="p5-logical-heading" aria-hidden={workspaceView!=='logical'}>
            <strong>Logical / Wiring workspace</strong>
            <span>Choose the first terminal, then a compatible second terminal. The worker validates each connection.</span>
          </div>
          <div className="p5-physical-stage">
          <div className="sandbox-scene-heading"><div><span className="eyebrow">Factory floor</span><h2>3D workspace</h2></div>
            <div><span className="sandbox-scene-stat">{project?.components.length ?? 0} devices</span><span className="sandbox-scene-stat">{project?.wires.length ?? 0} wires</span></div></div>
          <Suspense fallback={<div className="sandbox-3d-loading" role="status">Loading the interactive 3D workbench…</div>}>
            {project && snapshot && <Sandbox3D
              project={project} snapshot={snapshot} editable={editable}
              selectedTerminal={selectedTerminal} moveTarget={moveTarget}
              selectedDeviceId={selectedDeviceId} onSelectDevice={selectDevice}
              onTerminal={connect}
              onOperate={id => send([{ k: 'operateToggle', id }])}
              onPlace={(kind, at) => place(kind, at.x, at.y)}
              onMove={move} onMoveFinished={() => setMoveTarget(null)}
            />}
          </Suspense>
          {!project?.components.length && <div className="sandbox-3d-empty">
            <strong>Start with an empty 3D factory workbench.</strong>
            <span>Place and wire your own devices or load the starter equipment (without pre-wiring).</span>
            <button className="btn ghost small" onClick={layout}>Place starter layout</button>
          </div>}
          {!scenario && <PlantScenePanel project={project} snapshot={snapshot} editable={editable} onCommands={send} />}
          </div>
          <LogicalWiringCanvas project={project} snapshot={snapshot} editable={editable}
            selectedDeviceId={selectedDeviceId} selectedTerminal={selectedTerminal}
            onSelectDevice={id=>selectDevice(id)} onTerminal={connect} />
          <details id="sandbox-stage-wire" className="sandbox-patch panel p5-logical-stage" open>
            <summary>Component wiring &amp; keyboard controls · {project?.components.length ?? 0} devices</summary>
            <p className="sandbox-help">These controls access the same terminals and states shown in the 3D workbench. Use them on phones, with a keyboard, or when WebGL is unavailable.</p>
            <div className="sandbox-device-list">
              {project?.components.map(c => {
                const def = COMPONENTS[c.kind];
                const perDevice = snapshot ? perDeviceLive(snapshot, c) : undefined;
                const live = perDevice !== undefined ? perDevice :
                  c.kind === 'revmotor' ? snapshot?.motorDirection !== 'stopped' :
                  c.kind === 'forwardcontactor' ? snapshot?.forwardContactorOn :
                  c.kind === 'reversecontactor' ? snapshot?.reverseContactorOn :
                  c.kind === 'reversebutton' ? c.pressed :
                  c.kind === 'estop' ? !c.pressed :
                  c.kind === 'levelprobe' ? snapshot?.io.TankHigh :
                  c.kind === 'photoeye' ? snapshot?.io.Photoeye :
                  c.kind === 'start' || c.kind === 'stop' ? c.pressed : false;
                return <section className={`sandbox-device ${live ? 'active' : ''}`} key={c.id} data-device-id={c.id}>
                  <div className="sandbox-patch-head">
                    <button type="button" className="sandbox-inspect-link" onClick={() => selectDevice(c.id)}
                      aria-label={`Inspect ${def.label}`}>{def.label}</button>
                    <span className="sandbox-device-status">{c.kind === 'motor' ? (live ? 'RUNNING' : 'STOPPED') :
                      c.kind === 'contactor' || c.kind === 'relay' ? (live ? 'COIL ON' : 'COIL OFF') :
                      c.kind === 'timerelay' ? (() => { const t = snapshot?.timers[c.id]; return !t || t.elapsedMs === 0 ? 'COIL OFF' : t.done ? 'CONTACTS ON' : `TIMING ${Math.round(t.elapsedMs / t.delayMs * 100)}%`; })() :
                      c.kind === 'stacklight' ? (['R', 'Y', 'G'].filter(l => snapshot?.deviceOn[`${c.id}-${l}`]).join(' · ') || 'ALL OFF') :
                      c.kind === 'cylinder' ? (() => { const r = snapshot?.cylinders[c.id]; const base = !r || r.retractLimit ? 'RETRACTED' : r.extendLimit ? 'EXTENDED' : `MOVING ${Math.round(r.position * 100)}%`; return r?.alarm ? `${base} · ${r.alarm}` : base; })() :
                      isPlcKind(c.kind) ? (live ? 'POWER OK' : 'NO POWER') :
                      c.kind === 'conveyor' ? (live ? 'BELT MOVING' : 'BELT STOPPED') :
                      c.kind === 'photoeye' ? (live ? 'MARK DETECTED' : 'NO MARK') :
                      c.kind === 'diverter' ? (live ? 'REJECT ACTIVE' : 'PASS') :
                      c.kind === 'tank' ? `${Math.round(snapshot?.vessels[c.id]?.levelMl ?? 0)} ml` :
                      c.kind === 'pump' ? (live ? 'PUMPING' : 'STOPPED') :
                      c.kind === 'levelprobe' ? (live ? 'HIGH LEVEL' : 'LOW LEVEL') :
                      c.kind === 'drainvalve' ? (live ? 'DRAIN OPEN' : 'CLOSED') :
                      c.kind === 'breaker' ? (live ? 'CLOSED' : 'TRIPPED') :
                      c.kind === 'overload' ? (live ? '95-96 CLOSED' : 'TRIPPED') :
                      c.kind === 'revmotor' ? (snapshot?.motorDirection ?? 'stopped').toUpperCase() :
                      c.kind === 'forwardcontactor' || c.kind === 'reversecontactor' ?
                        (live ? 'CLOSED' : 'OPEN') :
                      c.kind === 'reversebutton' ? (c.pressed ? 'PRESSED' : 'RELEASED') :
                      c.kind === 'estop' ? (c.pressed ? 'OPEN · LATCHED' : 'NC · RESET') :
                      c.kind === 'lamp' ? (live ? 'ILLUMINATED' : 'OFF') :
                      c.kind === 'supply' ? '24V DC' : c.pressed ? 'PRESSED' : 'RELEASED'}</span>
                  </div>
                  <div className="sandbox-patch-actions">
                    {(c.kind === 'start' || c.kind === 'stop' || c.kind === 'estop' || c.kind === 'reversebutton') && <button
                      className={`sandbox-operate ${c.pressed ? 'pressed' : ''}`}
                      onClick={() => send([{ k: 'operateToggle', id: c.id }])}>
                        {c.kind === 'estop' ? (c.pressed ? 'Reset E-stop (training)' : 'Press E-stop (training)') :
                          c.pressed ? 'Release' : 'Press'}</button>}
                    {(c.kind === 'breaker' || c.kind === 'overload') && <button
                      type="button" className="sandbox-operate"
                      onClick={() => send([{k:'operateProtection',id:c.id,
                        action:live ? 'trip' : 'reset'}])}>
                      {live ? 'Trip (training)' : 'Reset protection'}</button>}
                    <button type="button" className="sandbox-position sandbox-remove" data-remove-device disabled={!editable}
                      aria-label={`Remove ${def.label} ${c.id}`} onClick={() => removeDevice(c.id)}>Remove</button>
                    <button type="button" className="sandbox-position" disabled={!editable}
                      aria-label={`Move ${def.label} in 3D`}
                      onClick={() => { setMoveTarget(c.id); selectDevice(c.id); }}>Move in 3D</button>
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
            <div><span className="eyebrow">Live I/O{plcList.length > 1 && activePlcId ? ` · ${activePlcId}` : ''}</span><div className="sandbox-lamps" tabIndex={0} role="region" aria-label="Live PLC I/O indicators">
              {activePlcView?.kind === 'plc16'
                ? [...activePlcView.io.inputs, ...activePlcView.io.outputs].map(p =>
                    <span className={p.on ? 'lit' : ''} key={p.terminal} title={p.terminal}><i />{p.tag}</span>)
                  .concat([<span className={activePlcView.powered ? 'lit' : ''} key="PlcPowered"><i />PlcPowered</span>])
                : (['Start', 'StopOK', 'Photoeye', 'TankHigh', 'ReverseRequest', 'Run', 'Sort', 'Fill', 'Drain', 'Forward', 'Reverse',
                  'Q0.0', 'Q0.1', 'Q0.2', 'Q0.3', 'Q0.4', 'Q0.5', 'PlcPowered'] as const).map(k =>
                <span className={activeIo[k] ? 'lit' : ''} key={k}><i />{k}</span>)}
              </div>
              {!!activePlcView?.io.analogInputs?.length && <div className="sandbox-analog-readings" aria-label="Numeric PLC inputs">
                {activePlcView.io.analogInputs.map(p => <p key={p.terminal} data-analog-input={p.terminal}>
                  {p.terminal} · {p.tag}: <strong>{p.connected ? `${p.value} ${p.unit}` : 'No numeric source'}</strong>
                  {p.source && <small> · {p.source}</small>}
                </p>)}
              </div>}
            </div>
            <div><span className="eyebrow">Plant</span>
              <p>Contactor: <strong>{snapshot?.contactorOn ? 'energised' : 'off'}</strong> · Motor: <strong>{snapshot?.motorOn ? 'running' : 'stopped'}</strong></p>
              {project?.components.some(c => c.kind === 'conveyor') && <p>
                Conveyor: <strong>{snapshot?.conveyorOn ? 'moving' : 'stopped'}</strong> ·
                Mark eye: <strong>{snapshot?.io.Photoeye ? 'detected' : 'clear'}</strong> ·
                Diverter: <strong>{snapshot?.diverterOn ? 'reject' : 'pass'}</strong></p>}
              {project?.components.some(c => c.kind === 'tank') && <p>
                Tank: <strong data-tank-brief>{Math.round(snapshot?.tank.levelMl ?? 0)} ml</strong> ·
                Pump: <strong>{snapshot?.pumpOn ? 'on' : 'off'}</strong> ·
                Drain: <strong>{snapshot?.drainOn ? 'open' : 'closed'}</strong></p>}
              {project?.components.filter(c=>c.kind==='star-delta-drive').map(drive=>{
            const motor=snapshot?.threePhase[drive.id];
            const meter=snapshot?.phaseMeters[drive.id];
            return <section key={drive.id} className="sandbox-protection-panel panel"
              aria-label={'Three-phase star delta motor '+drive.id} data-three-phase={drive.id}>
              <div className="sandbox-section-head"><div>
                <span className="eyebrow">P4 · isolated three-phase motor</span>
                <h2>Star / delta wiring · {drive.id}</h2></div>
                <span className="status-pill is-idle">Virtual 400V · non-rated teaching model</span>
              </div>
              <p className="sandbox-help">L1/L2/L3 and PE belong to a separate educational three-phase domain.
                Wire the MAIN+, STAR+, DELTA+ and M- 24V control coils to the PLC.
                The motor cannot run without matching phase conductors and actual energized 24V coils.
                Simultaneous STAR and DELTA demands are rejected; the PLC program is never automatically corrected.</p>
              <div className="sandbox-sort-metrics" aria-live="off">
                <span>Phase supply: <strong data-phase-status>{meter?.status??'isolated'}</strong></span>
                <span>Motor mode: <strong data-phase-mode>{motor?.motor.mode??'off'}</strong></span>
                <span>Speed: <strong data-phase-rpm>{Math.round(motor?.motor.speedRpm??0)} rpm</strong></span>
                <span>Current: <strong data-phase-amps>{(motor?.motor.currentA??0).toFixed(2)} A (estimated)</strong></span>
                <span>Thermal: <strong data-phase-thermal>{(motor?.motor.temperatureC??20).toFixed(1)} °C</strong></span>
                <span>Trip: <strong data-phase-trip>{motor?.motor.tripped?'TRIPPED':'CLEAR'}</strong></span>
                <span>Interlock: <strong data-phase-interlock>{motor?.conflict?'CONFLICT':'OK'}</strong></span>
              </div>
              {motor?.motor.diagnostics.length? <p role="status" className="sandbox-help">
                {motor.motor.diagnostics.slice(-3).join(' · ')}</p>:null}
              {!scenario&&<details><summary>Three-phase controls and limitations</summary>
                <p className="sandbox-help">The source can only be isolated while paused. Isolation does not certify safety.
                  The RESET+ coil is effective only with all three contactor commands deenergized,
                  after the simplified thermal model has cooled.</p>
                {project?.components.filter(c=>c.kind==='three-phase-supply').map(source=>
                  <button key={source.id} type="button" className="btn ghost small"
                    disabled={!editable} data-phase-source={source.id}
                    onClick={()=>send([{k:'setThreePhasePower',id:source.id,
                      enabled:snapshot?.threePhaseSources[source.id]===false}])}>
                    {snapshot?.threePhaseSources[source.id]===false?'Energize virtual '+source.id:
                      'Isolate virtual '+source.id}
                  </button>)}
              </details>}
            </section>;
          })}
          {project?.components.some(c => c.kind === 'revmotor') && <p>
                Direction: <strong data-reverse-direction>{snapshot?.motorDirection ?? 'stopped'}</strong> ·
                Forward: <strong>{snapshot?.forwardContactorOn ? 'on' : 'off'}</strong> ·
                Reverse: <strong>{snapshot?.reverseContactorOn ? 'on' : 'off'}</strong></p>}
              {project?.components.some(c => c.kind === 'overload') && <p>
                Breaker: <strong data-breaker-status>{snapshot?.breakerTripped ? 'TRIPPED' : 'CLOSED'}</strong> ·
                Overload: <strong data-overload-status>{snapshot?.overloadTripped ? 'TRIPPED' : 'CLOSED'}</strong> ·
                Pilot: <strong data-lamp-status>{snapshot?.lampOn ? 'ON' : 'OFF'}</strong></p>}</div>
          </div>
          {snapshot && project?.components.filter(c => c.kind === 'conveyor').map(conv => { const lane = snapshot.lanes[conv.id] ?? snapshot.plant; return <section key={conv.id}
            className="sandbox-sorting-panel panel" aria-label={`Conveyor sorting controls ${conv.id}`} data-lane={conv.id}>
            <div className="sandbox-section-head"><div>
              <span className="eyebrow">P3 · material handling</span>
              <h2>Conveyor sorting station{(project?.components.filter(c => c.kind === 'conveyor').length ?? 0) > 1 ? ` · ${conv.id}` : ''}</h2></div>
              <span className="status-pill is-idle">Single lane · bounded teaching model</span></div>
            <p className="sandbox-help">Feed one parcel at a time. Marked parcels activate the positioned optical detector;
              plain parcels do not. Your wired Q0.1 diverter determines the actual route.</p>
            <div className="sandbox-actions">
              <button type="button" className="btn ghost small" disabled={!!lane.parcel}
                onClick={() => send([{ k:'feedParcel', kind:'marked', conveyor: conv.id }])}>Feed marked parcel</button>
              <button type="button" className="btn ghost small" disabled={!!lane.parcel}
                onClick={() => send([{ k:'feedParcel', kind:'plain', conveyor: conv.id }])}>Feed plain parcel</button>
            </div>
            <div className="sandbox-sort-metrics" aria-live="off">
              <span>Current: <strong>{lane.parcel ?
                `${lane.parcel.kind} · ${Math.round(lane.parcel.position * 100)}% · ${lane.parcel.route}` :
                'empty'}</strong></span>
              <span>Accepted: <strong data-sort-accepted>{lane.accepted}</strong></span>
              <span>Rejected: <strong data-sort-rejected>{lane.rejected}</strong></span>
            </div>
            {!scenario && <details><summary>Wiring and logic for the sorting exercise</summary>
              <p className="sandbox-help">{sortingWireGuide}</p></details>}
          </section>; })}
          {snapshot && project && vesselsOf(project.components).map(v => { const level = snapshot.vessels[v.tank.id] ?? snapshot.tank; const pumpOn = v.pumps.some(p => snapshot.deviceOn[p.id]); const drainOn = v.valves.some(x => snapshot.deviceOn[x.id]); return <section key={v.tank.id}
            className="sandbox-tank-panel panel" aria-label={`Tank process controls ${v.tank.id}`} data-vessel={v.tank.id}>
            <div className="sandbox-section-head"><div>
              <span className="eyebrow">P3 · fluid handling</span>
              <h2>Programmable tank process{vesselsOf(project.components).length > 1 ? ` · ${v.tank.id}` : ''}</h2></div>
              <span className="status-pill is-idle">1000 ml · bounded process model</span></div>
            <p className="sandbox-help">The real wired Q0.2 inlet pump fills the positioned vessel.
              The level switch reports HIGH through I0.3 at 750 ml and clears below 600 ml.
              Q0.3 operates the wired drain valve. All changes come from the worker scan.</p>
            <div className="sandbox-tank-meter" role="progressbar" aria-label="Tank fill level"
              aria-valuemin={0} aria-valuemax={1000} aria-valuenow={Math.round(level.levelMl)}>
              <div className="sandbox-tank-meter-fill" style={{width: `${level.levelMl/10}%`}} />
            </div>
            <div className="sandbox-sort-metrics" aria-live="off">
              <span>Level: <strong data-tank-level>{Math.round(level.levelMl)} ml</strong></span>
              <span>High switch: <strong data-tank-high>{level.highLevel ? 'HIGH' : 'CLEAR'}</strong></span>
              <span>Pump: <strong data-tank-pump>{pumpOn ? 'ON' : 'OFF'}</strong></span>
              <span>Drain: <strong data-tank-drain>{drainOn ? 'OPEN' : 'CLOSED'}</strong></span>
            </div>
            {!scenario && <details><summary>Tank wiring and editable PLC example</summary>
              <p className="sandbox-help">{tankWireGuide}</p></details>}
          </section>; })}
          {project?.components.some(c => c.kind === 'revmotor') && snapshot && <section
            className="sandbox-protection-panel panel" aria-label="Forward reverse motor interlock">
            <div className="sandbox-section-head"><div><span className="eyebrow">P4 · electrical interlocks</span>
              <h2>Forward / reverse control</h2></div>
              <span className="status-pill is-idle">24V teaching drive · not 3-phase</span></div>
            <p className="sandbox-help">Physical NC 21–22 contacts cross-interlock the forward and reverse
              contactor coils. Example PLC logic also blocks simultaneous requests. Changing the
              wiring or program genuinely changes the motor feed; a modeled mechanical lockout
              inhibits simultaneous coil engagement.</p>
            <div className="sandbox-sort-metrics" aria-live="off">
              <span>Direction: <strong data-direction>{snapshot.motorDirection.toUpperCase()}</strong></span>
              <span>Forward contactor: <strong data-forward-contactor>{snapshot.forwardContactorOn ? 'CLOSED' : 'OPEN'}</strong></span>
              <span>Reverse contactor: <strong data-reverse-contactor>{snapshot.reverseContactorOn ? 'CLOSED' : 'OPEN'}</strong></span>
              <span>Interlock: <strong data-interlock>{snapshot.interlockConflict ? 'CONFLICT · BOTH INHIBITED' : 'NORMAL'}</strong></span>
            </div>
            {!scenario && <details><summary>21-wire reversing motor circuit</summary>
              <p className="sandbox-help">{reverseWireGuide}</p></details>}
          </section>}
          {project?.components.some(c => c.kind === 'overload') && <section
            className="sandbox-protection-panel panel" aria-label="Protected motor control panel">
            <div className="sandbox-section-head"><div>
              <span className="eyebrow">P4 · electrical panel</span>
              <h2>Protected 24V motor control</h2></div>
              <span className="status-pill is-idle">Training circuit · not safety-rated</span></div>
            <p className="sandbox-help">Protection and the pilot lamp are driven by the actual 24V netlist.
              A downstream direct short trips the latched breaker; a manual overload trip
              opens contact 95–96 and drops the contactor. These are bounded educational
              behaviors, not thermal ratings or certified fault clearing.</p>
            <div className="sandbox-sort-metrics" aria-live="off">
              <span>Breaker: <strong data-breaker-state>{snapshot?.breakerTripped ? 'TRIPPED' : 'CLOSED'}</strong></span>
              <span>Overload: <strong data-overload-state>{snapshot?.overloadTripped ? 'TRIPPED' : 'CLOSED'}</strong></span>
              <span>E-stop: <strong data-estop-state>{project?.components.find(c => c.kind === 'estop')?.pressed ? 'OPEN' : 'RESET'}</strong></span>
              <span>Motor: <strong data-panel-motor>{snapshot?.motorOn ? 'RUNNING' : 'STOPPED'}</strong></span>
              <span>Lamp: <strong data-panel-lamp>{snapshot?.lampOn ? 'ON' : 'OFF'}</strong></span>
            </div>
            {!scenario && <details><summary>16-wire protected DOL circuit</summary>
              <p className="sandbox-help">{protectedDOLGuide}</p></details>}
          </section>}
        </div>
        {inspectorExpanded&&<div className="p5-inspector-slot" data-p5-inspector>
        <WorkbenchInspector project={project ?? { formatVersion: 1, components: [], wires: [], program: { id: 'pending', version: '1', rungs: [] } }}
          snapshot={snapshot ?? { tick: 0, running: false, components: [], wires: [],
            io: { Start: false, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false,
              Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false,
              'Q0.0': false, 'Q0.1': false, 'Q0.2': false, 'Q0.3': false,
              'Q0.4': false, 'Q0.5': false, PlcPowered: false },
            voltages: {}, contactorOn: false, motorOn: false, motorAngleRad: 0,
            plcs: {}, deviceOn: {}, motorAngles: {}, lanes: {}, vessels: {}, tripped: {}, cylinders: {}, timers: {},
             threePhase: {}, phaseMeters: {}, threePhaseSources: {},
             plantWorld: { world: freshWorld(), signals: {} },
            forwardContactorOn: false, reverseContactorOn: false,
            motorDirection: 'stopped', reverseMotorAngleRad: 0, interlockConflict: false,
            conveyorOn: false, diverterOn: false,
            plant: { parcel: null, lastParcelId: 0, photoeyeActive: false, accepted: 0, rejected: 0 },
            tank: { levelMl: 0, highLevel: false, filledMl: 0, drainedMl: 0, spills: 0 },
            pumpOn: false, drainOn: false,
            breakerTripped: false, overloadTripped: false, lampOn: false,
            meter: { positive:null, negative:null, volts:null, status:'select' },
            diagnostics: [], lastError: null, alarms: [], language: 'ladder',
            tagValues: { Start: false, StopOK: false, Photoeye: false, TankHigh: false, ReverseRequest: false,
              Run: false, Sort: false, Fill: false, Drain: false, Forward: false, Reverse: false },
            ladderSteps: [], ladderMemory: {}, breakpointScan: null, breakpointHit: null,
            breakpointTag: null, scanTrace: [] }}
          selectedDevice={selectedDevice} selectedTerminal={selectedTerminal} editable={editable}
          onTerminal={connect} onCancelWire={() => setSelectedTerminal(null)}
          onMove={id => setMoveTarget(id)}
          onMoveTo={(id, at) => move(id, at)}
          onSetParam={(id, key, value) => send([{ k: 'setParam', id, key, value }])}
          onOperate={id => send([{ k: 'operateToggle', id }])}
          onClearSelection={() => setSelectedDeviceId(null)} />
        </div>}
      </div>
      <div className="p5-simulation-status" role="status" aria-label="Authoritative simulation state">
        <strong data-p5-sim-state>{snapshot?.running?'Running':snapshot?.breakpointHit?'Breakpoint':'Paused / editing'}</strong>
        <span>Scan <b>{snapshot?.tick??0}</b></span>
        <span>Model time <b>{((snapshot?.tick??0)*50/1000).toFixed(2)} s</b> · nominal 50 ms scans</span>
        <span>{project?.components.length??0} devices · {project?.wires.length??0} wires</span>
        {selectedTerminal&&<span>Wiring from <code>{selectedTerminal}</code></span>}
        {(clientError||snapshot?.lastError)&&<span className="p5-status-warning">Action error — inspect message above</span>}
      </div>
      <section className="p5-engineering-dock" data-p5-dock={dockFocus}>
        <header className="p5-dock-heading">
          <strong>Engineering dock</strong>
          <div role="group" aria-label="Dock panels">
            <button type="button" data-p5-dock-tab="program" aria-pressed={dockFocus==='program'}
              onClick={()=>{setDockFocus('program');setDockExpanded(true);}}>PLC program & I/O</button>
            <button type="button" data-p5-dock-tab="diagnostics" aria-pressed={dockFocus==='diagnostics'}
              onClick={()=>{setDockFocus('diagnostics');setDockExpanded(true);}}>Measurements · faults · events</button>
          </div>
          <button type="button" aria-expanded={dockExpanded}
            onClick={()=>setDockExpanded(v=>!v)}>{dockExpanded?'Collapse dock':'Expand dock'}</button>
        </header>
        {dockExpanded&&<div className="sandbox-bottom">
        <div id="sandbox-stage-program" className="sandbox-program-dock">
          {plcList.length > 1 && <div className="sandbox-plc-tabs" role="group" aria-label="Choose which PLC to program">
            <span className="eyebrow">Program</span>
            {plcList.map(c => <button key={c.id} type="button" data-plc-tab={c.id}
              className={c.id === activePlcId ? 'active' : ''} aria-pressed={c.id === activePlcId}
              onClick={() => setSelectedPlcId(c.id)}>{c.id}
              <small>{snapshot?.plcs[c.id]?.powered ? 'powered' : 'no power'}</small></button>)}
            {activePlcId !== plcList[0].id && <small className="sandbox-help">The scan trace, scan breakpoints and tag breakpoints
              follow the first PLC ({plcList[0].id}); the I/O lamps and the program editor follow {activePlcId}.</small>}
          </div>}
          {dockProject && dockSnapshot && <ProgrammingDock project={dockProject} snapshot={dockSnapshot} disabled={!editable}
            showExamples={!scenario}
            io={activePlcView ? { kind: activePlcView.kind, inputs: activePlcView.io.inputs, outputs: activePlcView.io.outputs,
              analogInputs: activePlcView.io.analogInputs } : undefined}
            onLadder={program => send([{ k: 'loadProgram', program, ...(activePlcId ? { plc: activePlcId } : {}) }])}
            onST={source => send([{ k: 'loadST', source, ...(activePlcId ? { plc: activePlcId } : {}) }])}
            onLanguage={language => send([{ k: 'activateLanguage', language, ...(activePlcId ? { plc: activePlcId } : {}) }])} />}
          {activePlcId && activePlcView?.kind === 'plc16' && <IoMappingPanel plcId={activePlcId} view={activePlcView} editable={editable} send={send} />}
        </div>
        <aside id="sandbox-stage-test" className="sandbox-instruments panel">
          {snapshot && <LiveMonitor snapshot={snapshot}
            onBreakpoint={scan => send([{ k: 'breakAtScan', scan }])}
            onTagBreakpoint={breakpoint => send([{ k: 'breakOnTag', breakpoint }])} />}
          <span className="eyebrow">Diagnostics</span><h2>Electrical &amp; event trace</h2>
          <p className="sandbox-help">Click a wire's remove button to break a connection and observe what changes. All values come from the simulator.</p>
          {!scenario && <details><summary>Example wiring map</summary><p>{wireGuide}</p>
            {plcList.length > 1 && <p>{twoPanelWireGuide}</p>}
            {project?.components.some(c => c.kind === 'conveyor') && <p>{sortingWireGuide}</p>}
            {project?.components.some(c => c.kind === 'tank') && <p>{tankWireGuide}</p>}
            {project?.components.some(c => c.kind === 'overload') && <p>{protectedDOLGuide}</p>}
            {project?.components.some(c => c.kind === 'revmotor') && <p>{reverseWireGuide}</p>}</details>}
          <h3>Wires ({project?.wires.length ?? 0})</h3>
          <div className="sandbox-wire-list">{project?.wires.map(w =>
            <div key={w.id}><code>{w.from} → {w.to}</code>
              <button disabled={!editable} aria-label={`Remove wire ${w.id}`} onClick={() => send([{ k: 'unwire', id: w.id }])}>×</button></div>)}</div>
          {selectedTerminal && <button className="btn ghost small" onClick={() => setSelectedTerminal(null)}>Cancel wire from {selectedTerminal}</button>}
          <section className="sandbox-meter" aria-label="Virtual DC multimeter">
            <span className="eyebrow">P4 · virtual instrument</span>
            <h3>Two-probe DC multimeter</h3>
            <p className="sandbox-help">Select two real terminals to read their differential
              potential from the 24V solver. Floating nodes and direct supply shorts
              report an unavailable reading. This is not calibrated test equipment.</p>
            <div className="sandbox-meter-leads">
              {(['positive','negative'] as const).map(lead=><label key={lead}>
                {lead === 'positive' ? 'Red (+) probe' : 'Black (−) probe'}
                <select aria-label={lead === 'positive' ? 'Red meter probe' : 'Black meter probe'}
                  value={snapshot?.meter[lead] ?? ''}
                  onChange={e=>send([{k:'setMeterProbe',lead,terminal:e.target.value||null}])}>
                  <option value="">Disconnected</option>
                  {meterTerminals.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </label>)}
            </div>
            <output className="sandbox-meter-reading" aria-live="polite" data-meter-status={snapshot?.meter.status}>
              {snapshot?.meter.status === 'measured' ? `${snapshot.meter.volts} V DC` :
                snapshot?.meter.status === 'short' ? 'Supply short · measurement unavailable' :
                snapshot?.meter.status === 'floating' ? 'Floating or unconnected terminal' :
                'Select both probes'}
            </output>
          </section>
          {project && snapshot && <TroubleshootingPanel project={project} snapshot={snapshot}
            editable={editable} send={send} instructor={!scenario} />}
          <h3>Voltage probes (V)</h3>
          <div className="sandbox-volts">{Object.entries(snapshot?.voltages ?? {}).filter(([name]) =>
            name.includes('I0.') || name.includes('Q0.') || name.endsWith('A1')).map(([name, value]) =>
              <div key={name}><code>{name}</code><strong>{value === null ? 'floating' : value ?? '—'}</strong></div>)}</div>
          <h3>Simulation events</h3>
          {snapshot?.diagnostics.map((d, i) => <p className="sandbox-diagnostic" key={i}>{d}</p>)}
          <div className="sandbox-event-list">{events.length ? events.map((e, i) => <p key={i}>{e}</p>) :
            <p className="sandbox-help">No changes recorded yet.</p>}</div>
        </aside>
      </div>}
      </section>
      <p className="sandbox-disclaimer">Educational, simplified 24V DC simulation only. Not safety-rated or a substitute for commissioning. This P4 development preview adds a simplified 24V breaker, overload contact, latching NC training E-stop, pilot lamp and virtual DC voltmeter, alongside P3 sorting and tank scenarios. It does not simulate real-world rated fault clearing, certified E-stop circuits or thermal motor protection. The underlying Ladder/ST and 24V circuit models remain educational and bounded; no factory-grade mechanics, automatic object recognition, hardware PLC, certified safety, full IEC coverage or real machinery are claimed.</p>
    </main>
  </>;
}
