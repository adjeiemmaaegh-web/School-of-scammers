import type { LadderDocument } from '../engineering/ladder';
import { fbdMotorStarter, type FbdDocument } from '../engineering/fbd';
import { FbdEditor } from './FbdEditor';
import { PlcTagTable } from './PlcTagTable';
import { LocalForcePanel } from './LocalForcePanel';
import type { ProjectFile, RenderSnapshot } from '../sim/signals';
import { LadderEditor } from './LadderEditor';
import { StructuredTextEditor } from './StructuredTextEditor';
import { DEFAULT_ST_SOURCE } from './p2-contract';
import './programming.css';

export function ProgrammingDock({ project, snapshot, disabled, onLadder, onST, onFBD, onLanguage, onLocalForce, showExamples = true, io }: {
  project: ProjectFile; snapshot: RenderSnapshot; disabled: boolean;
  /** Solved example programs and samples. Off in graded scenarios. */
  showExamples?: boolean;
  /** Selected PLC's I/O points; for a classic controller (or none) the fixed classic names apply. */
  io?: { kind: string; inputs: { terminal: string; tag: string }[]; outputs: { terminal: string; tag: string }[];
    analogInputs?: { terminal:string;tag:string;unit:string;value:number;connected:boolean }[] };
  onLadder: (program: LadderDocument) => void;
  onST: (source: string) => void;
  onFBD: (document: FbdDocument) => void;
  onLocalForce?: (tag:string,value:boolean|number|null) => void;
  onLanguage: (language: 'ladder' | 'st' | 'fbd') => void;
}) {
  const language = project.language ?? 'ladder';
  const configurable = io?.kind === 'plc16';
  const fbdIo=io?{inputs:io.inputs,outputs:io.outputs,
    numericInputs:io.analogInputs?.map(p=>({tag:p.tag}))}:undefined;
  return <div className="sandbox-programming-dock">
    <div className="sandbox-language-tabs" role="group" aria-label="PLC programming language">
      <button type="button" disabled={disabled} aria-pressed={language === 'ladder'}
        className={language === 'ladder' ? 'active' : ''} onClick={() => onLanguage('ladder')}>Ladder (LD)</button>
      <button type="button" disabled={disabled} aria-pressed={language === 'st'}
        className={language === 'st' ? 'active' : ''} onClick={() => onLanguage('st')}>Structured Text (ST)</button>
      <button type="button" disabled={disabled} aria-pressed={language === 'fbd'}
        className={language === 'fbd' ? 'active' : ''} onClick={() => onLanguage('fbd')}>Function Blocks (FBD)</button>
      <span>One active PLC runtime · saved in this project</span>
    </div>
    {language === 'st'
      ? <StructuredTextEditor source={project.stSource ?? DEFAULT_ST_SOURCE} snapshot={snapshot}
        disabled={disabled} onActivate={onST} showSamples={showExamples && !configurable} io={configurable ? io : undefined} />
      : language === 'fbd' ? <FbdEditor document={project.fbd ?? fbdMotorStarter()} snapshot={snapshot}
        disabled={disabled} onActivate={onFBD} showExamples={showExamples} io={fbdIo} />
      : <LadderEditor document={project.program} snapshot={snapshot} disabled={disabled} onChange={onLadder} showExamples={showExamples && !configurable} io={configurable ? io : undefined} />}
    <PlcTagTable project={project} snapshot={snapshot} disabled={disabled} io={fbdIo} onLadder={onLadder} />
    {language==='ladder'&&onLocalForce&&<LocalForcePanel document={project.program} disabled={disabled}
      active={snapshot.debugForces} liveValues={snapshot.tagValues} onForce={onLocalForce}/>}
  </div>;
}
