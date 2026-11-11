/**
 * Original 2D workcell authoring view. Uses exactly the same ProjectFile,
 * registered equipment models and worker snapshot as the 3D canvas.
 * View-local drag previews are never PLC inputs and are committed only by
 * validated worker commands after pointer release.
 */
import { useMemo, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import { COMPONENTS, componentKinds, type ComponentKind } from '../../components/registry';
import type { ProjectFile, RenderSnapshot, XY } from '../../sim/signals';
import { clampPlacement } from '../../workspace/geometry';
import type { GridStep } from '../../workspace/types';
import {
  PLAN_DEPTH, PLAN_WIDTH, footprintOf, planToPlacement,
  possibleCarrierOverlaps, workerToPlan,
} from '../../workspace/floor-plan';
import './floor-plan.css';

type Props = {
  project: ProjectFile;
  snapshot: RenderSnapshot;
  editable: boolean;
  grid: GridStep;
  selectedIds: readonly string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onPlace: (kind: ComponentKind, at: XY) => void;
  onMove: (id: string, at: XY) => void;
  onOpenWiring: () => void;
};
type DragState = {
  id: string; pointerId: number; origin: XY; start: XY; preview: XY;
};
type ClientPoint = { clientX: number; clientY: number };
const positionInPlan = (point: ClientPoint, svg: SVGSVGElement): XY => {
  const bounds = svg.getBoundingClientRect();
  return {
    x: (point.clientX - bounds.left) * PLAN_WIDTH / Math.max(1, bounds.width),
    y: (point.clientY - bounds.top) * PLAN_DEPTH / Math.max(1, bounds.height),
  };
};
const direction = (yawDeg: number): XY => ({
  x: yawDeg === 0 ? 1 : yawDeg === 180 ? -1 : 0,
  y: yawDeg === 90 ? 1 : yawDeg === 270 ? -1 : 0,
});
const pinOwner = (pin: string): string => pin.slice(0, pin.indexOf('.'));

export function FloorPlanCanvas({
  project, snapshot, editable, grid, selectedIds, onSelect, onPlace, onMove, onOpenWiring,
}: Props) {
  const [placementKind, setPlacementKind] = useState<ComponentKind | ''>('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showWires, setShowWires] = useState(true);
  const footprints = useMemo(() => project.components.map(c => footprintOf(c, project.params)),
    [project.components, project.params]);
  const overlaps = useMemo(() => possibleCarrierOverlaps(footprints), [footprints]);
  const byId = new Map(footprints.map(item => [item.id, item]));
  const pointOf = (event: ClientPoint, svg: SVGSVGElement) => positionInPlan(event, svg);
  const placeAt = (kind: ComponentKind, point: XY) => {
    if (editable) onPlace(kind, planToPlacement(point.x, point.y, grid));
  };
  const onFloorClick = (event: MouseEvent<SVGRectElement>) => {
    if (drag) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    if (placementKind && editable) placeAt(placementKind, pointOf(event, svg));
    else onSelect(null);
  };
  const onDevicePointerDown = (event: PointerEvent<SVGGElement>, id: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    // Sensors often mount ON conveyor footprints. Clicking a visible device in
    // placement mode still places the new part at that floor coordinate.
    if (placementKind) {
      if (editable) placeAt(placementKind, pointOf(event, svg));
      return;
    }
    const additive = event.ctrlKey || event.metaKey;
    onSelect(id, additive);
    if (!editable || additive) return;
    const device = project.components.find(c => c.id === id);
    if (!device) return;
    const pos = pointOf(event, svg);
    setDrag({ id, pointerId: event.pointerId, start: pos,
      origin: { x: device.x, y: device.y }, preview: { x: device.x, y: device.y } });
    svg.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const pos = pointOf(event, event.currentTarget);
    setDrag(previous => previous && previous.pointerId === event.pointerId ? {
      ...previous, preview: clampPlacement({
        x: previous.origin.x + pos.x - previous.start.x,
        y: previous.origin.y + pos.y - previous.start.y,
      }, grid),
    } : previous);
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pos = pointOf(event, event.currentTarget);
    const to = clampPlacement({
      x: drag.origin.x + pos.x - drag.start.x,
      y: drag.origin.y + pos.y - drag.start.y,
    }, grid);
    if (editable && (to.x !== drag.origin.x || to.y !== drag.origin.y)) onMove(drag.id, to);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  };
  const onDrop = (event: DragEvent<SVGSVGElement>) => {
    event.preventDefault();
    const code = event.dataTransfer.getData('text/plain');
    const kind = code.startsWith('add:') ? code.slice(4) : '';
    if (!editable || !Object.hasOwn(COMPONENTS, kind)) return;
    placeAt(kind as ComponentKind, pointOf(event, event.currentTarget));
  };
  return <section className="floor-plan-panel" aria-label="2D industrial workcell floor plan"
    data-floor-plan>
    <div className="floor-plan-controls">
      <label>Placement tool
        <select aria-label="Floor plan placement tool" data-floor-tool value={placementKind}
          disabled={!editable} onChange={event => setPlacementKind(event.target.value as ComponentKind | '')}>
          <option value="">Select / move equipment</option>
          {componentKinds.map(kind =>
            <option value={kind} key={kind}>{COMPONENTS[kind].label}</option>)}
        </select>
      </label>
      <button type="button" className="btn ghost small" onClick={() => setPlacementKind('')}
        disabled={!placementKind}>Cancel placement</button>
      <label className="floor-plan-wires">
        <input type="checkbox" checked={showWires} onChange={event => setShowWires(event.target.checked)} />
        Show wire routes
      </label>
      <button type="button" className="btn ghost small" onClick={onOpenWiring}>
        Open terminal wiring
      </button>
    </div>
    <p className="floor-plan-help">Choose equipment above and click an empty floor position, or drag a device from
      the library onto the plan. Select and drag a placed device to move it. Ctrl/⌘-click adds to a
      selection; use the editing toolbar for group movement, duplication and 90° rotation.
      Snap: {grid} plan units. Arrows show nominal equipment orientation, not powered state.</p>
    <svg viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_DEPTH}`} className="floor-plan-svg"
      role="img" aria-label="Top-down factory floor with movable equipment and worker-tracked parcels"
      onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onDragOver={event => { if (editable) event.preventDefault(); }} onDrop={onDrop}>
      <defs>
        <pattern id="floor-plan-grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0 H0 V25" stroke="#3d6177" strokeWidth="1" fill="none" opacity="0.45" />
        </pattern>
      </defs>
      <rect width={PLAN_WIDTH} height={PLAN_DEPTH} fill="#132b3b" data-floor-background
        onClick={onFloorClick} />
      <rect width={PLAN_WIDTH} height={PLAN_DEPTH} fill="url(#floor-plan-grid)"
        pointerEvents="none" />
      {showWires && project.wires.map(wire => {
        const start = byId.get(pinOwner(wire.from)), end = byId.get(pinOwner(wire.to));
        return start && end ? <path key={wire.id} d={`M ${start.x} ${start.y} L ${end.x} ${end.y}`}
          className="floor-plan-wire" pointerEvents="none" /> : null;
      })}
      {footprints.map(part => {
        const placed = project.components.find(c => c.id === part.id)!;
        const actual = drag?.id === part.id ? footprintOf({
          ...placed, x: drag.preview.x, y: drag.preview.y,
        }, project.params) : part;
        const selected = selectedIds.includes(part.id);
        const rotate = direction(actual.yawDeg);
        const isCarrier = actual.isCarrier;
        const live = snapshot.plantWorld.signals[part.id] ?? {};
        const active = Object.values(live).some(value => value === true);
        const width = Math.max(32, actual.width), depth = Math.max(24, actual.depth);
        return <g key={part.id} data-plan-device={part.id} role="button" tabIndex={0}
          aria-label={`${COMPONENTS[placed.kind].label}, ${part.id}, x ${placed.x}, y ${placed.y}`}
          aria-pressed={selected}
          onPointerDown={event => onDevicePointerDown(event, part.id)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault(); onSelect(part.id, event.ctrlKey || event.metaKey);
            }
          }}
          className={`floor-plan-device ${selected ? 'is-selected' : ''}`}
          transform={`translate(${actual.x},${actual.y})`}>
          <title>{COMPONENTS[placed.kind].label} · {part.id} · {placed.x}, {placed.y}</title>
          <rect x={-width / 2} y={-depth / 2} width={width} height={depth}
            rx={Math.min(7, depth / 5)} className={`floor-plan-shape ${isCarrier ? 'is-carrier' : ''} ${active ? 'is-active' : ''}`} />
          {isCarrier && <g className="floor-plan-direction" pointerEvents="none">
            <line x1={-rotate.x * width / 5} y1={-rotate.y * depth / 5}
              x2={rotate.x * width / 5} y2={rotate.y * depth / 5} />
            <polyline points={`${rotate.x * width / 5 - rotate.x * 6 + rotate.y * 4},${rotate.y * depth / 5 - rotate.y * 6 - rotate.x * 4} ${rotate.x * width / 5},${rotate.y * depth / 5} ${rotate.x * width / 5 - rotate.x * 6 - rotate.y * 4},${rotate.y * depth / 5 - rotate.y * 6 + rotate.x * 4}`} />
          </g>}
          <text textAnchor="middle" y="-3" pointerEvents="none">{COMPONENTS[placed.kind].label.slice(0, 17)}</text>
          <text textAnchor="middle" y="11" className="floor-plan-device-id" pointerEvents="none">{part.id.slice(0, 18)}</text>
        </g>;
      })}
      {snapshot.plantWorld.world.bodies.map(body => {
        const point = workerToPlan(body.pos.x, body.pos.y);
        const width = Math.max(8, body.size.x / 10);
        const depth = Math.max(8, body.size.y / 10);
        return <g key={body.id} transform={`translate(${point.x},${point.y})`}
          className="floor-plan-parcel" pointerEvents="none" data-plan-parcel={body.id}>
          <rect x={-width / 2} y={-depth / 2} width={width} height={depth}
            fill={body.tags.jammed === true ? '#f28368' : '#d4ad72'} stroke="#252d36" strokeWidth="2" />
          <text textAnchor="middle" y="3">{body.id}</text>
        </g>;
      })}
      {!project.components.length && <text x={PLAN_WIDTH / 2} y={PLAN_DEPTH / 2}
        textAnchor="middle" className="floor-plan-empty" pointerEvents="none">
        Empty floor · choose a part and click to place it
      </text>}
    </svg>
    <div className="floor-plan-status" role="status" aria-live="polite">
      <span>{project.components.length} devices · {project.wires.length} actual connections ·
        {snapshot.plantWorld.world.bodies.length} worker bodies</span>
      {overlaps.length > 0 && <span data-floor-overlap-warning className="floor-plan-overlap">
        Review potential transport overlap: {overlaps.slice(0, 4).map(pair =>
          pair.first + ' / ' + pair.second).join(', ')}
        {overlaps.length > 4 ? ` (+${overlaps.length - 4} more)` : ''}.
        Shared transfer zones may be intentional.</span>}
      {!editable && <span>Simulation running · pause to edit</span>}
    </div>
  </section>;
}
