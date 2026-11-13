import { useEffect, useState } from 'react';
import type { ProjectFile, RenderSnapshot } from '../sim/signals';
import { primaryPlcId, programOf } from '../sim/plcs';
import type { InstructionBreakpoint } from './instruction-breakpoint';
import { scanTraceCsv, type EdgeDirection, type TagBreakpoint } from './scan-trace';

export function LiveMonitor({ snapshot, project, onBreakpoint, onTagBreakpoint, onInstructionBreakpoint }: {
  snapshot: RenderSnapshot; project?: ProjectFile | null;
  onBreakpoint: (scan: number | null) => void;
  onTagBreakpoint: (breakpoint: TagBreakpoint | null) => void;
  onInstructionBreakpoint?: (breakpoint: InstructionBreakpoint | null) => void;
}) {
  const [target, setTarget] = useState('');
  const [watch, setWatch] = useState('');
  const [edgeTag, setEdgeTag] = useState('Run');
  const [edgeDirection, setEdgeDirection] = useState<EdgeDirection>('rising');
  const [instructionId, setInstructionId] = useState('');
  const [instructionMetric, setInstructionMetric] = useState<'edge'|'elapsedMs'|'count'>('edge');
  const [instructionEdge, setInstructionEdge] = useState<EdgeDirection>('rising');
  const [instructionThreshold, setInstructionThreshold] = useState('1');
  const firstProgram = project ? programOf(project, primaryPlcId(project)) : null;
  const instructions = firstProgram?.language==='fbd' ? firstProgram.fbd.nodes.map(n=>n.id) :
    firstProgram?.language==='ladder' ? firstProgram.program.rungs.map(r=>r.id) : [];
  const selectedInstruction = instructions.includes(instructionId) ? instructionId : instructions[0] ?? '';
  const thresholdNumber = Number(instructionThreshold);
  const thresholdOK = Number.isSafeInteger(thresholdNumber) && thresholdNumber>=1 && thresholdNumber<=1_000_000_000;
  const boolTags = Object.entries(snapshot.tagValues).filter(([,value]) =>
    typeof value === 'boolean').map(([name]) => name);
  useEffect(() => {
    if (snapshot.breakpointTag) {
      setEdgeTag(snapshot.breakpointTag.tag);
      setEdgeDirection(snapshot.breakpointTag.edge);
    }
  }, [snapshot.breakpointTag?.tag, snapshot.breakpointTag?.edge]);
  const exportTrace = () => {
    if (snapshot.scanTrace.length === 0) return;
    const csv = scanTraceCsv(snapshot.scanTrace);
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plc-scan-trace-${snapshot.tick}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  useEffect(() => {
    if (snapshot.breakpointScan !== null) setTarget(String(snapshot.breakpointScan));
  }, [snapshot.breakpointScan]);
  const values = Object.entries(snapshot.tagValues);
  const visible = watch.trim() ? values.filter(([name]) => name.toLowerCase().includes(watch.trim().toLowerCase())) : values;
  const threshold = Number(target);
  const valid = target.trim() !== '' && Number.isSafeInteger(threshold) &&
    threshold > snapshot.tick && threshold <= 1_000_000;
  return <section className="sandbox-live-monitor" aria-label="Live PLC monitor">
    <div className="sandbox-section-head"><div><span className="eyebrow">Engineering instrumentation</span><h2>Live PLC monitor</h2></div>
      <span className="status-pill is-idle">{snapshot.language.toUpperCase()} · scan {snapshot.tick}</span></div>
    <p className="sandbox-help">Values are sampled and published by the authoritative worker. Green means TRUE in this simulated snapshot, not electrical safety verification.</p>
    <label className="sandbox-monitor-search">Watch/filter tags
      <input type="search" value={watch} onChange={event => setWatch(event.target.value)}
        placeholder="Start, Run, Aux…" aria-label="Filter watched PLC tags" /></label>
    <div className="sandbox-monitor-table" role="table" tabIndex={0} aria-label="Live PLC tag values">
      <div role="row" className="sandbox-monitor-header"><span role="columnheader">Tag</span><span role="columnheader">Live value</span></div>
      {visible.map(([name,value]) =>
        <div role="row" key={name}><code role="cell">{name}</code>
          <strong role="cell" className={value === true ? 'is-live' : ''}>{typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value)}</strong></div>)}
      {!visible.length && <p className="sandbox-help">No matching signals.</p>}
    </div>
    {Object.keys(snapshot.ladderMemory).length > 0 && <details className="sandbox-memory-detail">
      <summary>Instruction memory (timers &amp; counters)</summary>
      {Object.entries(snapshot.ladderMemory).map(([rung, memory]) =>
        <div key={rung} className="sandbox-memory-row"><code>{rung}</code><span>{memory.elapsedMs} ms</span>
          <span>CV {memory.count}</span><strong>{memory.done ? 'Q TRUE' : 'Q FALSE'}</strong></div>)}
    </details>}
    <div className="sandbox-breakpoint-panel">
      <h3>Scan breakpoint</h3>
      <p className="sandbox-help">Choose a future scan. The worker stops after that scan completes; this does not force I/O.</p>
      <div>
        <input type="number" min={snapshot.tick + 1} max="1000000" value={target}
          placeholder="e.g. 25" aria-label="Breakpoint scan number"
          onChange={e => setTarget(e.target.value)} />
        <button className="btn ghost small" type="button" disabled={!valid || snapshot.running}
          onClick={() => onBreakpoint(threshold)}>Set</button>
        <button className="btn ghost small" type="button" disabled={snapshot.running || snapshot.breakpointScan === null}
          onClick={() => { onBreakpoint(null); setTarget(''); }}>Clear</button>
      </div>
      {snapshot.breakpointScan !== null && <p role="status">Armed at scan {snapshot.breakpointScan}</p>}
      {snapshot.breakpointHit && <p className="sandbox-breakpoint-hit" role="status">{snapshot.breakpointHit}</p>}
    </div>
    <div className="sandbox-breakpoint-panel">
      <h3>Tag edge breakpoint</h3>
      <p className="sandbox-help">Pause after the worker detects a real BOOL transition during a simulated scan. Never overrides physical inputs or outputs.</p>
      <div className="sandbox-breakpoint-fields">
        <label>PLC tag
          <select aria-label="Breakpoint PLC tag" value={boolTags.includes(edgeTag) ? edgeTag : boolTags[0] ?? ''}
            onChange={event => setEdgeTag(event.target.value)}>
            {boolTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <label>Signal edge
          <select aria-label="Breakpoint signal edge" value={edgeDirection}
            onChange={event => setEdgeDirection(event.target.value as EdgeDirection)}>
            <option value="rising">Rising</option>
            <option value="falling">Falling</option>
            <option value="either">Either</option>
          </select>
        </label>
      </div>
      <div>
        <button className="btn ghost small" type="button" disabled={snapshot.running || boolTags.length === 0}
          onClick={() => onTagBreakpoint({ tag: boolTags.includes(edgeTag) ? edgeTag : boolTags[0], edge: edgeDirection })}>Arm edge</button>
        <button className="btn ghost small" type="button" disabled={snapshot.running || snapshot.breakpointTag === null}
          onClick={() => onTagBreakpoint(null)}>Clear edge</button>
      </div>
      {snapshot.breakpointTag && <p role="status">Watching {snapshot.breakpointTag.tag} — {snapshot.breakpointTag.edge} edge</p>}
    </div>
    {onInstructionBreakpoint && <div className="sandbox-breakpoint-panel">
      <h3>Rung / function-block breakpoint</h3>
      <p className="sandbox-help">Inspect the first PLC's actual compiled Ladder rungs or FBD blocks. Pause after a transition, timer elapsed threshold, or counter value threshold. No manual input or actuator forcing is used.</p>
      <div className="sandbox-breakpoint-fields">
        <label>Instruction
          <select aria-label="Breakpoint rung or FBD block" value={selectedInstruction}
            onChange={event=>setInstructionId(event.target.value)}>
            {instructions.map(id=><option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <label>Condition
          <select aria-label="Instruction breakpoint condition" value={instructionMetric}
            onChange={event=>setInstructionMetric(event.target.value as 'edge'|'elapsedMs'|'count')}>
            <option value="edge">BOOL transition</option>
            <option value="elapsedMs">Timer ET (ms) reached</option>
            <option value="count">Counter CV reached</option>
          </select>
        </label>
        {instructionMetric==='edge'?<label>Edge
          <select aria-label="Instruction breakpoint edge" value={instructionEdge}
            onChange={event=>setInstructionEdge(event.target.value as EdgeDirection)}>
            <option value="rising">Rising</option><option value="falling">Falling</option>
            <option value="either">Either</option>
          </select>
        </label>:<label>Threshold
          <input type="number" aria-label="Instruction breakpoint threshold"
            min={1} max={1_000_000_000} value={instructionThreshold}
            onChange={event=>setInstructionThreshold(event.target.value)}/>
        </label>}
      </div>
      <div>
        <button className="btn ghost small" type="button"
          disabled={snapshot.running||!selectedInstruction||(instructionMetric!=='edge'&&!thresholdOK)}
          onClick={()=>onInstructionBreakpoint(instructionMetric==='edge'?
            {id:selectedInstruction,metric:'edge',edge:instructionEdge}:
            {id:selectedInstruction,metric:instructionMetric,threshold:thresholdNumber})}>Arm instruction</button>
        <button className="btn ghost small" type="button"
          disabled={snapshot.running||snapshot.breakpointInstruction===null}
          onClick={()=>onInstructionBreakpoint(null)}>Clear instruction</button>
      </div>
      {snapshot.breakpointInstruction&&<p role="status">Armed {snapshot.breakpointInstruction.id}
        {' · '}{snapshot.breakpointInstruction.metric}</p>}
      {firstProgram?.language==='st'&&<p className="sandbox-help">Instruction-level breakpoints are available in Ladder and FBD; use BOOL tag edges or scan numbers for ST.</p>}
    </div>}
    <div className="sandbox-scan-history">
      <div className="sandbox-section-head">
        <div><span className="eyebrow">PLC debugger</span><h3>Scan history</h3></div>
        <button type="button" className="btn ghost small" disabled={snapshot.scanTrace.length === 0}
          onClick={exportTrace}>Export scan CSV</button>
      </div>
      <p className="sandbox-help">Latest {snapshot.scanTrace.length} scans (maximum 300). Each record is calculated by the worker; the export contains only simulated signals and network results.</p>
      <div className="sandbox-scan-history-list" role="table" tabIndex={0} aria-label="Recent PLC scan trace">
        <div role="row"><strong role="columnheader">Scan</strong><strong role="columnheader">Run</strong><strong role="columnheader">Motor</strong></div>
        {snapshot.scanTrace.slice(-12).reverse().map(entry => <div role="row" key={entry.scan}>
          <span role="cell">{entry.scan}</span>
          <span role="cell">{entry.run ? 'TRUE' : 'FALSE'}</span>
          <span role="cell">{entry.motorOn ? 'RUNNING' : 'STOPPED'}</span>
        </div>)}
        {!snapshot.scanTrace.length && <p className="sandbox-help">Run or Step to capture scan evidence.</p>}
      </div>
    </div>
  </section>;
}
