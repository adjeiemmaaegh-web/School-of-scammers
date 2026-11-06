/**
 * PLC · Rank 1 · "Conveyor will not start"
 *
 * The reference exercise. Built directly on the salvaged deterministic engine
 * (src/engine/simulation.ts + assessment.ts). The learner reads a work order,
 * inspects the machine, reads PLC I/O to find the sensor fault, isolates and
 * reconnects the sensor, starts the motor, and verifies operation.
 */
import { useId } from 'react';
import type { ExerciseDefinition, ExercisePlayProps, RubricResult } from '../../../platform/types';
import { ConveyorArt, MotorArt, ParcelArt, PhotoeyeArt, Scene, StackLightArt } from '../../../ui/device-art';
import {
  initialMachine,
  inputs,
  outputs,
  transition,
  type Action,
  type Machine,
} from '../../../engine/simulation';
import { grade } from '../../../engine/assessment';

type S = Machine;
type A = Action;

function toRubric(m: Machine): RubricResult {
  const g = grade(m);
  return {
    score: g.score,
    max: g.max,
    passed: g.passed,
    safetyHold: g.safetyHold,
    criteria: g.criteria,
  };
}

const IO_LABELS: Record<string, string> = {
  I0_0_Start: 'Start button',
  I0_1_EStopOK: 'E-stop healthy',
  I0_2_GuardClosed: 'Guard closed',
  I0_3_PartSensor: 'Part detected',
  I0_4_SensorHealthy: 'Sensor circuit OK',
  Q0_0_Motor: 'Motor output',
};

function ConveyorScene({ machine }: { machine: Machine }) {
  const running = machine.motor;
  const sensorOk = machine.sensorHealthy;
  return (
    <Scene
      viewBox="0 0 480 240"
      label={`Conveyor scene. Motor is ${running ? 'running' : 'stopped'}. Sensor circuit is ${sensorOk ? 'healthy' : 'faulted'}.`}
    >
      <ConveyorArt x={58} y={104} length={360} running={running} />
      <g className={running ? 'parcel-move' : ''}>
        <ParcelArt x={120} y={100} />
      </g>
      <MotorArt x={384} y={150} scale={0.78} running={running} />
      <PhotoeyeArt x={232} y={58} healthy={sensorOk} beamLen={56} />
      <text x={244} y={48} textAnchor="middle" className="scene-label" fill={sensorOk ? 'var(--muted)' : 'var(--crit)'}>
        {sensorOk ? 'PHOTOEYE' : 'PHOTOEYE ✕'}
      </text>
      <StackLightArt x={40} y={96} red={machine.estop} amber={!running && !machine.estop} green={running} />
    </Scene>
  );
}

function ConveyorPlay({ state, mode, dispatch }: ExercisePlayProps<S, A>) {
  const machine = state;
  const io = { ...inputs(machine), ...outputs(machine) };
  const sceneHeadingId = useId();
  const locked = machine.submitted;

  return (
    <div className="exercise-sim">
      <div className="sim-canvas" aria-labelledby={sceneHeadingId}>
        <div className="sim-canvas-bar">
          <span id={sceneHeadingId}>Conveyor station · WO-001</span>
          <span className={`status-pill ${machine.motor ? 'is-ok' : 'is-idle'}`}>
            {machine.motor ? '● Running' : '● Stopped'}
          </span>
        </div>
        <ConveyorScene machine={machine} />
      </div>

      <div className="sim-controls">
        <div className="control-group">
          <span className="control-label">Inspection &amp; diagnostics</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch('inspect')} disabled={locked}>
              Record visual inspection
            </button>
            <button className="btn ghost" onClick={() => dispatch('read-plc')} disabled={locked}>
              Read PLC I/O
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Repair (isolate first)</span>
          <div className="control-row">
            <button className="btn ghost" onClick={() => dispatch('stop')} disabled={locked}>
              Stop / isolate motor
            </button>
            <button className="btn ghost" onClick={() => dispatch('repair-sensor')} disabled={locked}>
              Reconnect sensor circuit
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Operate &amp; verify</span>
          <div className="control-row">
            <button className="btn primary" onClick={() => dispatch('start')} disabled={locked}>
              Start motor
            </button>
            <button className="btn ghost" onClick={() => dispatch('verify')} disabled={locked}>
              Verify operation
            </button>
          </div>
        </div>
      </div>

      {machine.plcRead && (
        <div className="sim-instrument">
          <div className="instrument-head">
            <span>PLC I/O watch</span>
            <small>Live input &amp; output image</small>
          </div>
          <div className="io-grid">
            {Object.entries(io).map(([tag, val]) => (
              <div key={tag} className="io-cell">
                <code>{IO_LABELS[tag] ?? tag}</code>
                <strong className={val ? 'is-true' : 'is-false'}>{val ? 'TRUE' : 'FALSE'}</strong>
              </div>
            ))}
          </div>
          {mode === 'learning' && !machine.sensorHealthy && (
            <p className="instrument-hint">
              The sensor-circuit input reads FALSE — that is the permissive holding the motor off.
              Stop/isolate the motor command, then reconnect the sensor circuit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const conveyorStart: ExerciseDefinition<S, A> = {
  id: 'plc-conveyor-start',
  trade: 'plc',
  rank: 1,
  version: '1.0.0',
  title: 'Conveyor will not start',
  estMinutes: 20,
  summary: 'Diagnose a start permissive and safely restore a stopped conveyor motor.',
  scenario:
    'WO-001 — The operator reports that the conveyor start button does not energize the motor. ' +
    'Inspect the machine, use the PLC I/O to find the control fault, isolate the motor and restore ' +
    'the circuit, then start the conveyor and verify the repair.',
  objectives: [
    { id: 'inspect', label: 'Record a visual inspection' },
    { id: 'diagnose', label: 'Read PLC I/O and identify the fault' },
    { id: 'repair', label: 'Reconnect the sensor circuit with the motor isolated' },
    { id: 'run', label: 'Start the conveyor motor' },
    { id: 'verify', label: 'Verify operation' },
  ],
  hints: [
    'Start by recording a visual inspection, then read the PLC I/O.',
    'Compare the input image against what you expect — one permissive is holding the motor off.',
    'Isolate (stop) the motor command before you reconnect any wiring. Safety first.',
    'After reconnecting, start the motor and run the Verify check.',
  ],
  init: () => initialMachine(),
  reduce: (state, action) => {
    const next = transition(state, action);
    const last = next.events[next.events.length - 1];
    const event =
      last && next.events.length !== state.events.length
        ? { action: last.action, detail: last.detail, accepted: last.accepted }
        : undefined;
    return { next, event };
  },
  objectiveStatus: (m) => ({
    inspect: m.inspected,
    diagnose: m.plcRead && m.diagnosed,
    repair: m.repaired,
    run: m.motor,
    verify: m.verified,
  }),
  evaluate: (m) => toRubric(m),
  Play: ConveyorPlay,
};
