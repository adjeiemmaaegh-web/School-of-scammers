import { CATEGORIES, catalogueCounts } from '../../workspace/catalogue';
import type { WorkspaceCategory } from '../../workspace/types';

type Props = {
  category: WorkspaceCategory | 'All';
  onChange: (category: WorkspaceCategory | 'All') => void;
};
/** The registry remains the source of truth; filters never duplicate equipment definitions. */
export function WorkspaceLibraryFilters({ category, onChange }: Props) {
  const counts = catalogueCounts();
  return <label className="workspace-library-filter">
    <span>Equipment category</span>
    <select aria-label="Filter equipment category" value={category}
      onChange={event => onChange(event.target.value as WorkspaceCategory | 'All')}>
      <option value="All">All categories</option>
      {CATEGORIES.map(name => <option key={name} value={name}>{name} ({counts[name]})</option>)}
    </select>
  </label>;
}
