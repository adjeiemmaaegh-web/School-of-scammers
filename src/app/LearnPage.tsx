import { Link } from 'react-router-dom';
import { SCENARIO_META } from '../exercises/meta';
import { loadProgress } from '../platform/persistence';
import { AppHeader } from '../ui/AppHeader';
import { LEGACY_LABS } from './labs-index';

/** Learn & Practice: a separate, secondary section. Everything here runs on the real simulator or its labs. */
export function LearnPage() {
  const progress = loadProgress();
  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <nav className="crumbs"><Link to="/">Home</Link><span>/</span><strong>Learn &amp; Practice</strong></nav>
        <span className="eyebrow">Learn &amp; practice</span>
        <h1 className="page-title">Guided practice on the real simulator</h1>
        <p className="sub">Tutorials, ranked exercises and work-order scenarios. None of this is required: you can <Link to="/sandbox">open the simulator</Link> and build freely at any time.</p>

        <div className="hub-cards">
          <Link to="/sandbox" className="hub-card"><h2>Open simulator</h2><p>An empty 3D floor. Build, wire, program and run anything the component library supports.</p><span className="go">Go to the simulator →</span></Link>
          <Link to="/trades" className="hub-card"><h2>Guided exercises</h2><p>A ranked 1&ndash;10 ladder of hands-on tasks, PLC first, with hints and instant feedback.</p><span className="go">Open the ladder →</span></Link>
          <Link to="/labs" className="hub-card"><h2>Engineering labs</h2><p>Focused bench tools for one topic at a time.</p><span className="go">Open the labs →</span></Link>
        </div>

        <section aria-labelledby="learn-scenarios" style={{ marginTop: 40 }}>
          <h2 id="learn-scenarios" className="sec-title">Simulator scenarios</h2>
          <p className="sub">Work orders you complete in the 3D simulator. Each is checked by what your circuit actually does when it runs.</p>
          <div className="hub-cards">
            {SCENARIO_META.map(s => {
              const p = progress[s.id];
              return (
                <Link key={s.id} to={`/scenario/${s.id}`} className="hub-card" data-learn-scenario={s.id}>
                  <h3>{s.title}</h3>
                  <p>{s.summary}</p>
                  <span className="go">Rank {s.rank} · ~{s.estMinutes} min · {p?.passed ? `Passed ${p.bestScore}%` : p ? `Best ${p.bestScore}%` : 'Not started'} →</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="learn-labs" style={{ marginTop: 40 }}>
          <h2 id="learn-labs" className="sec-title">Engineering labs</h2>
          <div className="hub-cards">
            {LEGACY_LABS.filter(l => l.path !== 'assessments').map(l => (
              <Link key={l.path} to={`/labs/${l.path}`} className="hub-card"><h3>{l.label}</h3><p>{l.detail}</p><span className="go">Open →</span></Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
