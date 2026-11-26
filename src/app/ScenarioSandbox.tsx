import { useMemo } from 'react';
import { getScenario } from '../exercises/catalogue';
import type { ScenarioRequest, ScenarioSession } from '../exercises/session';
import { SandboxPage } from './SandboxPage';

/**
 * The scenario workbench: resolves the scenario definition (its starter project and behavioural grading checks) and opens
 * the ordinary sandbox with it. Kept apart from `SandboxPage` so the open /sandbox route does not download the headless
 * grading benches; only scenario and candidate pages load this chunk.
 */
export function ScenarioSandbox({ scenario: request }: { scenario: ScenarioRequest }) {
  const session = useMemo<ScenarioSession | undefined>(() => {
    const def = getScenario(request.scenarioId);
    if (!def) return undefined;
    const { scenarioId: _id, ...rest } = request;
    return { ...rest, def };
  }, [request]);
  return <SandboxPage scenario={session} />;
}
