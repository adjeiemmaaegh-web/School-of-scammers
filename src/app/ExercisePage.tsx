import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getExercise } from '../trades/registry';
import { recordProgress } from '../platform/persistence';
import type { AttemptResult } from '../platform/types';
import { AppHeader } from '../ui/AppHeader';
import { ExercisePlayer } from '../ui/ExercisePlayer';

export function ExercisePage() {
  const { exerciseId = '' } = useParams();
  const def = getExercise(exerciseId);

  const onSubmitted = useCallback(
    (r: AttemptResult) => {
      const pct = r.rubric.max > 0 ? Math.round((r.rubric.score / r.rubric.max) * 100) : 0;
      recordProgress(r.assignment.exerciseId, pct, r.rubric.passed);
    },
    [],
  );

  if (!def) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page">
          <h1 className="page-title">Exercise not found</h1>
          <Link className="btn ghost" to="/trades">← Back to trades</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader right={<Link className="btn ghost small" to={`/trade/${def.trade}`}>← Ladder</Link>} />
      <main id="main" className="wrap wrap-wide page">
        <ExercisePlayer def={def} initialMode="learning" onSubmitted={onSubmitted} />
      </main>
    </>
  );
}
