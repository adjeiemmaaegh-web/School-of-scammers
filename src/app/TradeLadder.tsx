import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getLadder, getTrade } from '../trades/registry';
import { loadProgress, type ProgressMap } from '../platform/persistence';
import { AppHeader } from '../ui/AppHeader';

export function TradeLadder() {
  const { tradeId = '' } = useParams();
  const trade = getTrade(tradeId);
  const ladder = getLadder(tradeId);
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  if (!trade) {
    return (
      <>
        <AppHeader />
        <main id="main" className="wrap page">
          <h1 className="page-title">Trade not found</h1>
          <Link className="btn ghost" to="/trades">← Back to trades</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <nav className="crumbs"><Link to="/">Home</Link><span>/</span><Link to="/trades">Trades</Link><span>/</span><strong>{trade.meta.name}</strong></nav>
        <span className="eyebrow">{trade.meta.name} · 1–10 ladder</span>
        <h1 className="page-title">Climb the ladder, rung by rung</h1>
        <p className="sub">{trade.meta.blurb} Each rung is a self-contained, realistic task. Difficulty rises from entry to expert.</p>
        {(() => {
          const playable = ladder.filter((r) => r.status === 'playable');
          const passed = playable.filter((r) => r.def && progress[r.def.id]?.passed).length;
          if (playable.length === 0) return null;
          return (
            <div className="ladder-progress" aria-label={`${passed} of ${playable.length} exercises passed`}>
              <div className="ladder-progress-bar"><span style={{ width: `${(passed / playable.length) * 100}%` }} /></div>
              <span className="tabular">{passed} / {playable.length} passed</span>
            </div>
          );
        })()}

        <ol className="ladder-list">
          {ladder.map((rung) => {
            const prog = rung.def ? progress[rung.def.id] : undefined;
            const playable = rung.status === 'playable';
            const inner = (
              <>
                <div className="ladder-rank">{rung.rank}</div>
                <div className="ladder-body">
                  <div className="ladder-row-top">
                    <h3>{rung.title}</h3>
                    {playable ? (
                      prog?.passed ? <span className="status-pill is-ok">✓ Passed · {prog.bestScore}%</span>
                        : prog ? <span className="status-pill is-idle">Best {prog.bestScore}%</span>
                          : <span className="status-pill is-idle">Not started</span>
                    ) : (
                      <span className="trade-status soon">Coming soon</span>
                    )}
                  </div>
                  <p>{rung.summary}</p>
                  <div className="ladder-meta">
                    {rung.estMinutes && <span>~{rung.estMinutes} min</span>}
                    {playable && <span className="ladder-go">Open exercise →</span>}
                  </div>
                </div>
              </>
            );
            return (
              <li key={rung.rank} className={`ladder-item ${playable ? 'playable' : 'planned'}`}>
                {playable && rung.def ? (
                  <Link to={`/exercise/${rung.def.id}`} className="ladder-link">{inner}</Link>
                ) : (
                  <div className="ladder-link">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
