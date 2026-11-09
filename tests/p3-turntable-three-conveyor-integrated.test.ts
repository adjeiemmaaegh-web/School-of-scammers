/** Full user-authored three-roller + turntable integration, no renderer animation.
 * A single worker owns PLC16 ST, 24V wiring, 10ms body physics and sensor truth.
 * The simplified plant is educational; this test does not claim industrial fidelity.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import { plantPlacements } from '../src/sim/p3-plant-bridge';
import { conserved } from '../src/plant/world/bodies';
import type { Command, WorldState } from '../src/sim/signals';

const ST = [
  'VAR_INPUT',
  ' In0 : BOOL;', ' In1 : BOOL;', ' In2 : BOOL;', 'END_VAR',
  'VAR_OUTPUT',
  ...Array.from({ length: 8 }, (_, i) => ` Out${i} : BOOL;`),
  'END_VAR',
  'VAR',
  ' Count : INT := 0;', ' Rotate : BOOL := FALSE;',
  'END_VAR',
  'Count := Count + 1;',
  'IF In1 THEN Rotate := TRUE; END_IF;',
  'Out0 := In0;', // incoming roller
  'Out1 := In0;', // turntable roller
  'Out2 := Rotate;', // genuine powered quarter turn, held until completion
  'Out3 := In0;', // east outbound roller
  'Out4 := In0;', // north outbound roller (90 degree saved yaw)
  'Out5 := In0 AND Count = 1;', // one-scan feeder enable
  'Out6 := In0 AND Count = 1;', // one-scan feeder pulse
  'Out7 := In2;', // north exit photoeye drives a wired pilot
].join('\n');

const pieces: Array<[string, Extract<Command, { k: 'place' }>['kind'], number, number]> = [
  ['supply', 'supply', 10, 10], ['ctrl', 'plc16', 260, 10],
  ['feeder', 'box-feeder', 390, 225],
  ['in', 'roller-conveyor', 410, 225],
  ['table', 'turntable', 455, 225],
  ['east', 'roller-conveyor', 503, 225],
  ['north', 'roller-conveyor', 455, 273],
  ['eye1', 'geometry-photoeye', 448, 225],
  ['eye2', 'geometry-photoeye', 455, 260],
  ['pilot', 'lamp', 580, 225],
];

const links: Array<[string, string, string]> = [
  ['power-plc', 'supply.P24', 'ctrl.L+'],
  ['common-plc', 'supply.M0', 'ctrl.M'],
  ['start', 'supply.P24', 'ctrl.I0.0'],
  ['in-drive', 'ctrl.Q0.0', 'in.CMD_run+'],
  ['in-return', 'supply.M0', 'in.M-'],
  ['table-roll', 'ctrl.Q0.1', 'table.CMD_run+'],
  ['table-turn', 'ctrl.Q0.2', 'table.CMD_turn+'],
  ['table-return', 'supply.M0', 'table.M-'],
  ['east-drive', 'ctrl.Q0.3', 'east.CMD_run+'],
  ['east-return', 'supply.M0', 'east.M-'],
  ['north-drive', 'ctrl.Q0.4', 'north.CMD_run+'],
  ['north-return', 'supply.M0', 'north.M-'],
  ['feeder-enable', 'ctrl.Q0.5', 'feeder.CMD_enable+'],
  ['feeder-feed', 'ctrl.Q0.6', 'feeder.CMD_feed+'],
  ['feeder-return', 'supply.M0', 'feeder.M-'],
  ['eye1-power', 'supply.P24', 'eye1.L+'],
  ['eye1-return', 'supply.M0', 'eye1.M'],
  ['eye1-signal', 'eye1.OUT_present', 'ctrl.I0.1'],
  ['eye2-power', 'supply.P24', 'eye2.L+'],
  ['eye2-return', 'supply.M0', 'eye2.M'],
  ['eye2-signal', 'eye2.OUT_present', 'ctrl.I0.2'],
  ['pilot-drive', 'ctrl.Q0.7', 'pilot.L+'],
  ['pilot-return', 'supply.M0', 'pilot.M-'],
];

function author(source = ST, missingWires: string[] = []) {
  const commands: Command[] = [
    ...pieces.map(([id, kind, x, y]) => ({ k: 'place' as const, id, kind, at: { x, y } })),
    { k: 'editWorkspace', edit: { kind: 'rotate', ids: ['north'], quarterTurns: 1 } },
    ...links.filter(([id]) => !missingWires.includes(id))
      .map(([id, from, to]) => ({ k: 'wire' as const, id, from, to })),
    { k: 'loadST', source },
  ];
  const w = tick(createWorld(), commands).world;
  expect(w.lastError).toBeNull();
  expect(w.project.components).toHaveLength(pieces.length);
  expect(w.project.components.find(c => c.id === 'north')?.yawDeg).toBe(90);
  expect(plantPlacements(w.project).find(c => c.id === 'north')?.yawDeg).toBe(90);
  return w;
}
function executeToDestination(base: WorldState, maxScans = 850) {
  let world = tick(base, [{ k: 'run' }]).world;
  expect(world.lastError).toBeNull();
  let sawFirst = false, sawSecond = false, sawPilot = false, tableRotated = false;
  let eastReached = false, northReached = false;
  for (let index = 0; index < maxScans && world.running; index++) {
    world = tick(world).world;
    sawFirst ||= world.plantWorld.signals.eye1?.present === true;
    sawSecond ||= world.plantWorld.signals.eye2?.present === true;
    sawPilot ||= world.deviceOn.pilot === true;
    tableRotated ||= world.plantWorld.signals.table?.rotated === true;
    eastReached ||= world.plantWorld.world.bodies.some(b => b.supportedBy === 'east');
    northReached ||= world.plantWorld.world.bodies.some(b => b.supportedBy === 'north');
    if (northReached || eastReached) {
      // Allow the next scan to sample the exit sensor before finishing.
      for (let k = 0; k < 15; k++) {
        world = tick(world).world;
        sawSecond ||= world.plantWorld.signals.eye2?.present === true;
        sawPilot ||= world.deviceOn.pilot === true;
      }
      break;
    }
  }
  return { world, sawFirst, sawSecond, sawPilot, tableRotated, eastReached, northReached };
}

describe('three rollers + powered turntable + two geometry photoeyes through the actual worker', () => {
  it('moves a real parcel north on actual PLC sensor feedback and saves editable 90-degree orientation', () => {
    const source = author();
    const result = executeToDestination(source);
    expect(result.world.lastError).toBeNull();
    expect(result.world.plantWorld.world.spawnedCount).toBe(1);
    expect(result.sawFirst).toBe(true);
    expect(result.tableRotated).toBe(true);
    expect(result.northReached).toBe(true);
    expect(result.eastReached).toBe(false);
    expect(result.sawSecond).toBe(true);
    expect(result.sawPilot).toBe(true);
    expect(conserved(result.world.plantWorld.world)).toBe(true);
    const saved = JSON.parse(JSON.stringify(source.project));
    expect(validateProject(saved)).toEqual(source.project);
    expect(saved.wires).toHaveLength(links.length);
    expect(saved.stSource).toBe(ST);
    const reopened = tick(createWorld(), [{ k: 'loadProject', project: saved }]).world;
    expect(reopened.lastError).toBeNull();
    const original = tick(source, [{ k: 'run' }]).world;
    const loaded = tick(reopened, [{ k: 'run' }]).world;
    expect(JSON.stringify(renderSnapshot(loaded))).toBe(JSON.stringify(renderSnapshot(original)));
  });

  it('a deliberately wrong ST turn output routes the same parcel east, not north', () => {
    const wrong = author(ST.replace('Out2 := Rotate;', 'Out2 := FALSE;'));
    const result = executeToDestination(wrong);
    expect(result.world.lastError).toBeNull();
    expect(result.world.plantWorld.world.spawnedCount).toBe(1);
    expect(result.sawFirst).toBe(true);
    expect(result.tableRotated).toBe(false);
    expect(result.eastReached).toBe(true);
    expect(result.northReached).toBe(false);
  });

  it('cutting the physical turntable output wire prevents rotation despite correct program', () => {
    const result = executeToDestination(author(ST, ['table-turn']));
    expect(result.world.lastError).toBeNull();
    expect(result.tableRotated).toBe(false);
    expect(result.eastReached).toBe(true);
    expect(result.northReached).toBe(false);
  });

  it('unwired sensor cannot secretly steer the table; same source project replays identically', () => {
    const base = author(ST, ['eye1-signal']);
    const a = executeToDestination(base);
    const b = executeToDestination(tick(createWorld(), [{ k: 'loadProject', project: base.project }]).world);
    expect(a.tableRotated).toBe(false);
    expect(a.northReached).toBe(false);
    expect(a.eastReached).toBe(true);
    expect(JSON.stringify(renderSnapshot(a.world))).toBe(JSON.stringify(renderSnapshot(b.world)));
  });
});
