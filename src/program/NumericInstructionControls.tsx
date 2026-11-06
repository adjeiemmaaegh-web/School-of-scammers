import type { NumericOperand, NumericRungOperation } from '../engineering/ladder';

function Operand({ label, value, numbers, onChange }: {
  label: string; value: NumericOperand; numbers: readonly string[];
  onChange: (value: NumericOperand) => void;
}) {
  const mode = value.kind === 'tag' ? `tag:${value.name}` : 'literal';
  return <label className="sandbox-numeric-operand">
    <span>{label}</span>
    <select aria-label={`${label} source`} value={mode} onChange={event => {
      const selected = event.target.value;
      onChange(selected === 'literal' ? { kind: 'literal', value: 0 } :
        { kind: 'tag', name: selected.slice(4) });
    }}>
      <option value="literal">Constant</option>
      {numbers.map(tag => <option key={tag} value={`tag:${tag}`}>{tag}</option>)}
    </select>
    {value.kind === 'literal' && <input aria-label={`${label} constant`} type="number"
      min="-1000000000" max="1000000000" step="any" value={value.value}
      onChange={event => onChange({ kind: 'literal', value: Number(event.target.value) })} />}
  </label>;
}
/** Pure instruction editor: no PLC result is ever computed here. */
export function NumericInstructionControls({ operation, numbers, onChange }: {
  operation: NumericRungOperation; numbers: readonly string[];
  onChange: (operation: NumericRungOperation) => void;
}) {
  const set = (part: Partial<NumericRungOperation>) =>
    onChange({ ...operation, ...part } as NumericRungOperation);
  return <div className="sandbox-numeric-instruction" aria-label="Numeric PLC instruction">
    {operation.kind !== 'compare' && <label className="sandbox-numeric-target">
      Numeric destination
      <select aria-label="Numeric destination tag" value={operation.target}
        onChange={event => set({ target: event.target.value } as Partial<NumericRungOperation>)}>
        {numbers.map(tag => <option key={tag} value={tag}>{tag}</option>)}
      </select>
    </label>}
    <Operand label="Left operand" value={operation.left} numbers={numbers}
      onChange={left => set({ left })} />
    {operation.kind === 'compare' && <label className="sandbox-numeric-target">
      Comparison
      <select aria-label="Comparison operator" value={operation.comparator}
        onChange={event => onChange({ ...operation,
          comparator: event.target.value as typeof operation.comparator })}>
        <option value="eq">Equal (=)</option><option value="ne">Not equal (≠)</option>
        <option value="lt">Less than (&lt;)</option><option value="le">Less or equal (≤)</option>
        <option value="gt">Greater than (&gt;)</option><option value="ge">Greater or equal (≥)</option>
      </select>
    </label>}
    {operation.kind !== 'move' && <Operand label="Right operand" value={operation.right}
      numbers={numbers} onChange={right => set({ right } as Partial<NumericRungOperation>)} />}
    <p className="sandbox-help">
      {operation.kind === 'compare' ? 'Comparison gates the Boolean rung coil; no numeric register is overwritten.' :
        'This instruction writes the local numeric destination only when rung conditions conduct. Later rungs read the updated value.'}
    </p>
  </div>;
}
