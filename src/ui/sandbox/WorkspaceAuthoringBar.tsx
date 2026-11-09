import type { GridStep } from '../../workspace/types';
import { GRID_STEPS } from '../../workspace/geometry';
import './workspace-authoring.css';

type Props = {
  editable: boolean;
  selectedCount: number;
  canUndo: boolean; canRedo: boolean; canPaste: boolean;
  grid: GridStep; onGrid: (grid: GridStep) => void;
  onUndo: () => void; onRedo: () => void;
  onCopy: () => void; onPaste: () => void; onDuplicate: () => void;
  onRemove: () => void; onRotate: (turns: -1 | 1) => void;
  onNudge: (dx: number, dy: number) => void;
};

/** The toolbar only dispatches edits; the worker validates and owns project mutations. */
export function WorkspaceAuthoringBar(props: Props) {
  const selected = props.editable && props.selectedCount > 0;
  const group = props.selectedCount > 1 ? String(props.selectedCount) + ' devices' :
    props.selectedCount ? '1 device' : 'Nothing selected';
  return <div className="workspace-authoring-bar" role="group" aria-label="Workspace editing tools">
    <span className="workspace-selection-count" aria-live="polite">{group}</span>
    <button type="button" className="btn ghost small" data-undo disabled={!props.editable || !props.canUndo}
      title="Undo last accepted project edit (Ctrl+Z)" onClick={props.onUndo}>Undo</button>
    <button type="button" className="btn ghost small" data-redo disabled={!props.editable || !props.canRedo}
      title="Redo edit (Ctrl+Shift+Z)" onClick={props.onRedo}>Redo</button>
    <button type="button" className="btn ghost small" disabled={!selected} onClick={props.onCopy}
      title="Copy selected equipment and any internal wires (Ctrl+C)">Copy</button>
    <button type="button" className="btn ghost small" disabled={!props.editable || !props.canPaste}
      onClick={props.onPaste} title="Paste copied equipment in this project (Ctrl+V)">Paste</button>
    <button type="button" className="btn ghost small" data-duplicate disabled={!selected}
      onClick={props.onDuplicate} title="Duplicate selection and internal wires (Ctrl+D)">Duplicate</button>
    <button type="button" className="btn ghost small" disabled={!selected}
      onClick={() => props.onRotate(-1)} title="Rotate selection left by 90° (electrical equipment only)">↶ 90°</button>
    <button type="button" className="btn ghost small" disabled={!selected}
      onClick={() => props.onRotate(1)} title="Rotate selection right by 90° (electrical equipment only)">↷ 90°</button>
    <button type="button" className="btn ghost small" data-delete-selection disabled={!selected}
      onClick={props.onRemove} title="Delete selected devices, dependent wires and faults">Delete</button>
    <label className="workspace-grid-label">Snap
      <select aria-label="Workspace snap grid size" value={props.grid}
        onChange={e => props.onGrid(Number(e.target.value) as GridStep)}>
        {GRID_STEPS.map(step => <option key={step} value={step}>{step} unit{step > 1 ? 's' : ''}</option>)}
      </select>
    </label>
    <div className="workspace-nudges" role="group" aria-label="Move selected equipment one grid step">
      <button type="button" disabled={!selected} onClick={() => props.onNudge(-props.grid, 0)} aria-label="Move selection left">←</button>
      <button type="button" disabled={!selected} onClick={() => props.onNudge(0, -props.grid)} aria-label="Move selection up">↑</button>
      <button type="button" disabled={!selected} onClick={() => props.onNudge(0, props.grid)} aria-label="Move selection down">↓</button>
      <button type="button" disabled={!selected} onClick={() => props.onNudge(props.grid, 0)} aria-label="Move selection right">→</button>
    </div>
  </div>;
}
