/**
 * R02 drawn shape editor: a live top view and side view of a learner's blocks, with one editable row per block and Add / Remove
 * buttons. It edits the same JSON definition the worker validates (the text is the single source of truth), so a shape drawn here
 * is exactly what Define sends. Educational preview: bounding boxes and true turns are drawn, not collision meshes.
 */
import type { ReactNode } from 'react';
import { MAX_SHAPE_BLOCKS, type CustomShapeDef, type ShapeBlock } from '../../plant/world/custom-shapes';

const FIELDS: Array<[keyof ShapeBlock & ('x' | 'y' | 'z' | 'w' | 'd' | 'h' | 'yawDeg'), string]> = [['x', 'x'], ['y', 'y'], ['z', 'z'], ['w', 'width'], ['d', 'depth'], ['h', 'height'], ['yawDeg', 'turn°']];
const COLOURS = ['#4d8fb0', '#c9a24a', '#6aa384', '#b86a5a', '#8a78b8', '#5aa3a8', '#b88aa0', '#8a9a5a'];

type Parsed = { def: CustomShapeDef } | { error: string };
export function parseShape(text: string): Parsed {
  try {
    const def = JSON.parse(text) as CustomShapeDef;
    if (!def || typeof def !== 'object' || !Array.isArray(def.blocks)) return { error: 'The definition needs a "blocks" list.' };
    return { def };
  } catch { return { error: 'The definition is not valid JSON yet.' }; }
}
const aabb = (b: ShapeBlock) => {
  const t = (b.yawDeg ?? 0) * Math.PI / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  const w = c * b.w + s * b.d, d = s * b.w + c * b.d, cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2, z0: b.z, z1: b.z + b.h };
};

function View({ def, side, label }: { def: CustomShapeDef; side: boolean; label: string }): ReactNode {
  const blocks = def.blocks.filter(b => b && [b.x, b.y, b.z, b.w, b.d, b.h].every(Number.isFinite) && b.w > 0 && b.d > 0 && b.h > 0);
  if (!blocks.length) return <p className="sandbox-help">Nothing to draw yet.</p>;
  const boxes = blocks.map(aabb);
  const a0 = Math.min(...boxes.map(b => b.x0)), a1 = Math.max(...boxes.map(b => b.x1));
  const b0 = Math.min(...boxes.map(b => side ? b.z0 : b.y0)), b1 = Math.max(...boxes.map(b => side ? b.z1 : b.y1));
  const pad = Math.max(a1 - a0, b1 - b0, 1) * 0.08, W = a1 - a0 + 2 * pad, H = b1 - b0 + 2 * pad;
  // The side view stands upright (z grows up); the top view has y growing down the page.
  const sy = (v: number) => (side ? (b1 - v) : (v - b0)) + pad, sx = (v: number) => v - a0 + pad;
  return <figure className="sandbox-shape-view"><svg role="img" aria-label={label} data-shape-view={side ? 'side' : 'top'} viewBox={`0 0 ${W} ${H}`} width="100%" height="140" preserveAspectRatio="xMidYMid meet">
    <rect x="0" y="0" width={W} height={H} fill="none" stroke="currentColor" strokeOpacity=".18" />
    {blocks.map((b, i) => {
      const fill = COLOURS[i % COLOURS.length], round = b.shape === 'sphere' || b.shape === 'cylinder';
      if (side) {
        const x = sx(aabb(b).x0), y = sy(b.z + b.h), w = aabb(b).x1 - aabb(b).x0;
        return b.shape === 'sphere' ? <ellipse key={i} data-shape-block={i} cx={x + w / 2} cy={y + b.h / 2} rx={w / 2} ry={b.h / 2} fill={fill} fillOpacity=".75" stroke="#222" />
          : <rect key={i} data-shape-block={i} x={x} y={y} width={w} height={b.h} rx={b.shape === 'cylinder' ? w * .08 : 0} fill={fill} fillOpacity=".75" stroke="#222" />;
      }
      const cx = sx(b.x + b.w / 2), cy = sy(b.y + b.d / 2);
      return round ? <ellipse key={i} data-shape-block={i} cx={cx} cy={cy} rx={b.w / 2} ry={b.d / 2} fill={fill} fillOpacity=".75" stroke="#222" />
        : <rect key={i} data-shape-block={i} x={cx - b.w / 2} y={cy - b.d / 2} width={b.w} height={b.d} fill={fill} fillOpacity=".75" stroke="#222"
          transform={b.yawDeg ? `rotate(${b.yawDeg} ${cx} ${cy})` : undefined} />;
    })}
  </svg><figcaption className="sandbox-help">{label}</figcaption></figure>;
}

export function ShapeEditor({ text, onChange, disabled }: { text: string; onChange: (text: string) => void; disabled?: boolean }) {
  const parsed = parseShape(text);
  if ('error' in parsed) return <p role="status" data-shape-editor-note>{parsed.error} The drawing returns when it is.</p>;
  const { def } = parsed;
  const commit = (next: CustomShapeDef) => onChange(JSON.stringify(next, null, 2));
  const setBlock = (i: number, patch: Partial<ShapeBlock>) => commit({ ...def, blocks: def.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const add = () => {
    const last = def.blocks[def.blocks.length - 1];
    commit({ ...def, blocks: [...def.blocks, { x: last ? last.x + last.w : 0, y: last?.y ?? 0, z: 0, w: 60, d: 60, h: 60 }] });
  };
  return <div data-shape-editor>
    <div className="sandbox-shape-views"><View def={def} side={false} label="Top view (x across, y down)" /><View def={def} side label="Side view (x across, height up)" /></div>
    <table className="sandbox-shape-blocks"><thead><tr><th>#</th>{FIELDS.map(([, label]) => <th key={label}>{label}</th>)}<th>shape</th><th /></tr></thead>
      <tbody>{def.blocks.map((b, i) => <tr key={i} data-shape-row={i}>
        <td><span style={{ color: COLOURS[i % COLOURS.length] }}>■</span> {i + 1}</td>
        {FIELDS.map(([key]) => <td key={key}><input type="number" data-block-field={`${i}-${key}`} aria-label={`block ${i + 1} ${key}`} disabled={disabled} step={key === 'yawDeg' ? 5 : 10}
          defaultValue={b[key] ?? (key === 'yawDeg' ? 0 : '')} key={`${i}-${key}-${b[key] ?? ''}`}
          onBlur={e => { const v = e.target.value === '' ? NaN : Number(e.target.value);
            if (key === 'yawDeg') setBlock(i, { yawDeg: v === 0 || Number.isNaN(v) ? undefined : v }); else if (Number.isFinite(v) && v !== b[key]) setBlock(i, { [key]: v } as Partial<ShapeBlock>); }} /></td>)}
        <td><select data-block-shape={i} disabled={disabled} value={b.shape ?? 'box'} onChange={e => setBlock(i, { shape: e.target.value === 'box' ? undefined : e.target.value as ShapeBlock['shape'] })}>
          <option value="box">box</option><option value="cylinder">cylinder</option><option value="sphere">sphere</option></select></td>
        <td><button type="button" className="btn ghost small" data-block-remove={i} disabled={disabled || def.blocks.length < 2}
          onClick={() => commit({ ...def, blocks: def.blocks.filter((_, j) => j !== i) })}>Remove</button></td>
      </tr>)}</tbody></table>
    <button type="button" className="btn ghost small" data-block-add disabled={disabled || def.blocks.length >= MAX_SHAPE_BLOCKS} onClick={add}>Add block</button>
    <p className="sandbox-help">Drawn from your blocks as you edit. A turned box is drawn at its true angle and collided as its bounding box; a sphere needs equal width, depth and height. The preview is for design only, the worker still validates every shape.</p>
  </div>;
}
