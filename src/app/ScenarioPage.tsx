import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getScenario } from '../exercises';
import type { ScenarioSession } from '../exercises/session';
import { recordProgress } from '../platform/persistence';
import type { AttemptResult } from '../platform/types';
import { AppHeader } from '../ui/AppHeader';

const SandboxPage = lazy(() => import('./SandboxPage').then(m => ({ default: m.SandboxPage })));
const seedKey = (id: string) => `efo-scenario-seed-v1:${id}`;
const rollSeed = () => Math.floor(Math.random() * 1_000_000) + 1;

/** Practice a scenario on the real sandbox. The seed picks variants (e.g. which fault is hidden). */
export function ScenarioPage() {
  const { scenarioId = '' } = useParams();
  const [params] = useSearchParams();
  const def = getScenario(scenarioId);
  const querySeed = Number.parseInt(params.get('seed') ?? '', 10);
  const [seed, setSeed] = useState<number>(() => {
    if (Number.isSafeInteger(querySeed) && querySeed > 0) return querySeed;
    try {
      const saved = Number.parseInt(localStorage.getItem(seedKey(scenarioId)) ?? '', 10);
      if (Number.isSafeInteger(saved) && saved > 0) return saved;
      const fresh = rollSeed();
      localStorage.setItem(seedKey(scenarioId), String(fresh));
      return fresh;
    } catch { return rollSeed(); }
  });
  const onRestart = useCallback(() => {
    const fresh = rollSeed();
    try { localStorage.setItem(seedKey(scenarioId), String(fresh)); } catch { /* seed just will not persist */ }
    setSeed(fresh);
  }, [scenarioId]);
  const session = useMemo<ScenarioSession | null>(() => def ? {
    def, mode: 'learning', seed, allowRestart: true, onRestart,
    onSubmitted: (r: AttemptResult) => {
      const pct = r.rubric.max > 0 ? Math.round((r.rubric.score / r.rubric.max) * 100) : 0;
      recordProgress(r.assignment.exerciseId, pct, r.rubric.passed);
    },
  } : null, [def, seed, onRestart]);

  if (!def || !session) {
    return <>
      <AppHeader />
      <main id="main" className="wrap page">
        <h1 className="page-title">Scenario not found</h1>
        <Link className="btn ghost" to="/trades">← Back to trades</Link>
      </main>
    </>;
  }
  return <Suspense fallback={<main id="main" className="wrap wrap-wide page">
    <p role="status">Loading the 3D engineering workbench…</p></main>}>
    <SandboxPage key={`${def.id}:${seed}`} scenario={session} />
  </Suspense>;
}
