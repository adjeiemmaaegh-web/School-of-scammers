import type { PlacedComponent } from '../../sim/signals';
import { COMPONENTS } from '../../components/registry';
import './workspace-authoring.css';

type Props = {
  components: readonly PlacedComponent[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
};
/** Accessible keyboard/touch alternative to multi-selecting 3D meshes with Ctrl/Meta. */
export function WorkspaceSelectionPanel({ components, selected, onToggle, onSelectAll, onClear }: Props) {
  return <details className="workspace-selection-panel panel" data-workspace-selection>
    <summary>Group selection · {selected.length} of {components.length} selected</summary>
    <p className="sandbox-help">Check devices to move, copy or delete them together. Ctrl/⌘-click a 3D device to add or remove it from the selection. Only wires between copied devices are included when duplicating.</p>
    <div className="workspace-selection-actions">
      <button type="button" className="btn ghost small" disabled={!components.length} onClick={onSelectAll}>Select all</button>
      <button type="button" className="btn ghost small" disabled={!selected.length} onClick={onClear}>Clear selection</button>
    </div>
    <div className="workspace-selection-list" role="group" aria-label="Select devices for group edit">
      {components.map(part => <label key={part.id}>
        <input type="checkbox" checked={selected.includes(part.id)} onChange={() => onToggle(part.id)} />
        <span><strong>{COMPONENTS[part.kind].label}</strong><small>{part.id} · ({part.x}, {part.y})</small></span>
      </label>)}
      {!components.length && <span className="sandbox-help">Place equipment to make a selection.</span>}
    </div>
  </details>;
}
