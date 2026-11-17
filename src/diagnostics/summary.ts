/**
 * Diagnostics overview (roadmap R8.1): one pure summary of what the worker currently publishes, so the learner sees
 * power rails, controllers, alarms and device states in one place. Every value is read from the snapshot; nothing is
 * inferred from the drawing, and hidden faults are never counted or named here.
 */
import type { ProjectFile, RenderSnapshot } from '../sim/signals';

export type RailReading = { supply: string; state: 'live' | 'floating' | 'short'; volts: number | null };
export type DiagnosticsSummary = {
  scan: number; running: boolean;
  rails: RailReading[];
  controllers: { id: string; powered: boolean; outputsOn: number; inputsOn: number }[];
  activeAlarms: { id: number; severity: string; message: string }[];
  devicesOn: string[];
  shortCircuit: boolean;
  revealedFaults: number;
};

export function summarizeDiagnostics(project: ProjectFile, snapshot: RenderSnapshot): DiagnosticsSummary {
  const shortCircuit = snapshot.diagnostics.some(d => d.startsWith('Supply short'));
  const rails: RailReading[] = project.components.filter(c => c.kind === 'supply').map(c => {
    const hi = snapshot.voltages[`${c.id}.P24`], lo = snapshot.voltages[`${c.id}.M0`];
    if (shortCircuit) return { supply: c.id, state: 'short' as const, volts: null };
    if (typeof hi === 'number' && typeof lo === 'number') return { supply: c.id, state: 'live' as const, volts: hi - lo };
    return { supply: c.id, state: 'floating' as const, volts: null };
  });
  const controllers = Object.entries(snapshot.plcs).map(([id, view]) => ({
    id, powered: view.powered, inputsOn: view.io.inputs.filter(p => p.on).length, outputsOn: view.io.outputs.filter(p => p.on).length,
  }));
  return {
    scan: snapshot.tick, running: snapshot.running, rails, controllers,
    activeAlarms: snapshot.alarms.filter(a => a.clearedAtScan === null).map(a => ({ id: a.id, severity: a.severity, message: a.message })),
    devicesOn: project.components.filter(c => snapshot.deviceOn[c.id] === true).map(c => c.id).sort(),
    shortCircuit,
    revealedFaults: (project.faults ?? []).filter(f => !f.hidden).length,
  };
}
