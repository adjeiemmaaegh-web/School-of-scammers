import type { LadderDocument } from '../engineering/ladder';
import type { ProjectFile, RenderSnapshot } from '../sim/signals';
import { LadderEditor } from './LadderEditor';
import { StructuredTextEditor } from './StructuredTextEditor';
import { DEFAULT_ST_SOURCE } from './p2-contract';
import './programming.css';

export function ProgrammingDock({ project, snapshot, disabled, onLadder, onST, onLanguage, showExamples = true }: {
  project: ProjectFile; snapshot: RenderSnapshot; disabled: boolean;
  /** Solved example programs and samples. Off in graded scenarios. */
  showExamples?: boolean;
  onLadder: (program: LadderDocument) => void;
  onST: (source: string) => void;
  onLanguage: (language: 'ladder' | 'st') => void;
}) {
  const language = project.language ?? 'ladder';
  return <div className="sandbox-programming-dock">
    <div className="sandbox-language-tabs" role="group" aria-label="PLC programming language">
      <button type="button" disabled={disabled} aria-pressed={language === 'ladder'}
        className={language === 'ladder' ? 'active' : ''} onClick={() => onLanguage('ladder')}>Ladder (LD)</button>
      <button type="button" disabled={disabled} aria-pressed={language === 'st'}
        className={language === 'st' ? 'active' : ''} onClick={() => onLanguage('st')}>Structured Text (ST)</button>
      <span>One active PLC runtime · saved in this project</span>
    </div>
    {language === 'st'
      ? <StructuredTextEditor source={project.stSource ?? DEFAULT_ST_SOURCE} snapshot={snapshot}
        disabled={disabled} onActivate={onST} showSamples={showExamples} />
      : <LadderEditor document={project.program} snapshot={snapshot} disabled={disabled} onChange={onLadder} showExamples={showExamples} />}
  </div>;
}
