import { Link } from 'react-router-dom';
import { BRAND } from '../platform/config';
import { allTrades, getLadder } from '../trades/registry';
import { AppHeader } from '../ui/AppHeader';

function Check() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 10.5l3.2 3.2L15.5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TRADE_ICON: Record<string, React.ReactNode> = {
  plc: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M7 4v16M3 9h4M3 14h4M11 8h7M11 12h7M11 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ),
  cctv: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 8h10l6-3v14l-6-3H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="9" cy="11" r="2.4" stroke="currentColor" strokeWidth="1.6" /></svg>
  ),
  bms: (
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><rect x="8" y="12" width="3" height="3" stroke="currentColor" strokeWidth="1.5" /><rect x="13" y="12" width="3" height="3" stroke="currentColor" strokeWidth="1.5" /></svg>
  ),
  'phone-pc': (
    <svg viewBox="0 0 24 24" fill="none"><rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M10 5.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="18" r="1.1" fill="currentColor" /></svg>
  ),
  electronics: (
    <svg viewBox="0 0 24 24" fill="none"><rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><path d="M10 7V3M14 7V3M10 21v-4M14 21v-4M7 10H3M7 14H3M21 10h-4M21 14h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  ),
};

export function FrontDoor() {
  const trades = allTrades();
  const plcLadder = getLadder('plc');

  return (
    <>
      <AppHeader
        right={
          <nav className="front-nav">
            <a href="#problem">Why</a>
            <a href="#audiences">Who it's for</a>
            <a href="#trades">Trades</a>
          </nav>
        }
      />

      {/* Hero */}
      <section className="hero">
        <div className="wrap wrap-wide hero-grid">
          <div>
            <span className="eyebrow">Virtual trade simulator &amp; practical assessment</span>
            <h1 className="hero-title">
              Practice the trade.<br />
              <span className="amber">Prove</span> you can do the job.
            </h1>
            <p className="lede">{BRAND.shortPitch} Think Cisco Packet Tracer, for the skilled trades.</p>
            <div className="cta-row">
              <Link className="btn primary" to="/trades">Enter the lab →</Link>
              <a className="btn ghost" href="#how">See how it works</a>
            </div>
            <div className="tagstrip">
              <span className="chip">Wire it · it works or it doesn't</span>
              <span className="chip">Diagnose real faults</span>
              <span className="chip">10 ranked exercises</span>
              <span className="chip">No hardware needed</span>
            </div>
          </div>

          <figure className="schematic">
            <figcaption className="schematic-cap">
              <span>WO-001 · Conveyor start fault</span>
              <span className="dot"><span className="led" /> LIVE SCAN</span>
            </figcaption>
            <div className="rungbox">
              <svg viewBox="0 0 340 150" width="100%" role="img" aria-label="A ladder-logic rung with a start contact and seal-in branch energizing a motor coil.">
                <line x1="12" y1="18" x2="12" y2="132" stroke="var(--muted)" strokeWidth="2" />
                <line x1="328" y1="18" x2="328" y2="132" stroke="var(--muted)" strokeWidth="2" />
                <line x1="12" y1="52" x2="96" y2="52" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="96" y1="42" x2="96" y2="62" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="116" y1="42" x2="116" y2="62" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="116" y1="52" x2="210" y2="52" stroke="var(--ok)" strokeWidth="2.4" />
                <text x="90" y="34" className="rung-tag" textAnchor="middle">START</text>
                <line x1="210" y1="52" x2="250" y2="52" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="250" y1="42" x2="250" y2="62" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="270" y1="42" x2="270" y2="62" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="250" y1="42" x2="270" y2="62" stroke="var(--ok)" strokeWidth="2" />
                <line x1="270" y1="52" x2="300" y2="52" stroke="var(--ok)" strokeWidth="2.4" />
                <text x="260" y="34" className="rung-tag" textAnchor="middle">E-STOP</text>
                <path d="M300 44 a9 9 0 0 1 0 16" fill="none" stroke="var(--accent)" strokeWidth="2.6" />
                <path d="M312 44 a9 9 0 0 0 0 16" fill="none" stroke="var(--accent)" strokeWidth="2.6" />
                <text x="306" y="34" className="rung-tag amber-tag" textAnchor="middle">MOTOR</text>
                <line x1="40" y1="52" x2="40" y2="92" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="40" y1="92" x2="96" y2="92" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="96" y1="82" x2="96" y2="102" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="116" y1="82" x2="116" y2="102" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="116" y1="92" x2="180" y2="92" stroke="var(--ok)" strokeWidth="2.4" />
                <line x1="180" y1="52" x2="180" y2="92" stroke="var(--ok)" strokeWidth="2.4" />
                <text x="106" y="118" className="rung-tag" textAnchor="middle">MOTOR (seal-in)</text>
                <rect className="scanline" x="20" y="16" width="2.5" height="118" fill="var(--accent)" opacity="0.5" />
              </svg>
            </div>
            <p className="schematic-foot">Every control changes real simulated state — the picture shows the engine's truth, not a script.</p>
          </figure>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="band-ink">
        <div className="wrap sec">
          <span className="eyebrow">The problem</span>
          <h2 className="sec-title">Trades are hard to practice — and harder to hire for.</h2>
          <p className="sub">Hands-on skills can't be learned from a textbook or judged from a CV. The gap costs learners opportunity and costs employers bad hires.</p>
          <div className="prob-grid">
            <div className="prob">
              <div className="n">01</div>
              <h3>Hardware is a barrier</h3>
              <p>PLC racks, licensed IDEs, wiring benches and lab machines cost money and space most learners don't have. So they never get to actually do the work.</p>
            </div>
            <div className="prob">
              <div className="n">02</div>
              <h3>Hiring tests the wrong thing</h3>
              <p>Interviews and certificates don't reveal whether someone can wire a panel, find a fault or commission a line. Employers hire book-knowledge and find out on the job.</p>
            </div>
            <div className="prob">
              <div className="n">03</div>
              <h3>Existing tools miss the middle</h3>
              <p>Quizzes are too shallow; full engineering simulators are powerful but intimidating. Nothing is both realistic and usable by a normal learner or a busy interviewer.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section id="audiences">
        <div className="wrap sec">
          <span className="eyebrow">Who it's for</span>
          <h2 className="sec-title">Two front doors. One simulation engine.</h2>
          <p className="sub">The same realistic tasks that teach a learner are the ones an employer uses to test a candidate. Author an exercise once; use it to build skill and to prove it.</p>
          <div className="doors">
            <div className="door">
              <span className="who">For learners &amp; students</span>
              <h3>Build real skills, safely</h3>
              <p>Open a guided simulation and learn by doing — from zero, without buying hardware, with room to make mistakes and see exactly what goes wrong.</p>
              <ul>
                <li><Check />Guided, step-by-step tasks with hints and instant feedback</li>
                <li><Check />Reset and replay as often as you like — no stakes</li>
                <li><Check />Climb a clear 1→10 difficulty ladder</li>
              </ul>
              <Link className="btn primary block door-cta" to="/trades">Start learning</Link>
            </div>
            <div className="door">
              <span className="who">For employers &amp; interviewers</span>
              <h3>Test the work, not the words</h3>
              <p>Give a candidate a realistic, situation-based task at the difficulty you need. Get back an objective, evidence-backed result — what they did, how they diagnosed, whether they respected safety.</p>
              <ul>
                <li><Check />Pick a ranked, job-like exercise</li>
                <li><Check />Send it to a candidate; they complete it under exam conditions</li>
                <li><Check />Read a rubric result with a full, replayable action trail</li>
              </ul>
              <Link className="btn ghost block door-cta" to="/employer">Set up a test</Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="band">
        <div className="wrap sec">
          <span className="eyebrow">How it works</span>
          <h2 className="sec-title">Realistic tasks with real cause and effect.</h2>
          <p className="sub">Each exercise is a simulated environment, not a multiple-choice question. The difference is you can get it wrong — and figure out why.</p>
          <div className="how">
            <div className="step"><div className="k">01</div><h3>Read the brief</h3><p>A work-order-style scenario with clear objectives — "the conveyor won't start; diagnose and restore it."</p></div>
            <div className="step"><div className="k">02</div><h3>Do the work</h3><p>Wire circuits, edit logic, measure signals, clear faults on an interactive canvas. The simulation responds truthfully.</p></div>
            <div className="step"><div className="k">03</div><h3>See the evidence</h3><p>Learners get feedback and progress; employers get a rubric result and a replayable trail of every action.</p></div>
          </div>

          <div className="ladder-card">
            <div className="ladder-cap">
              <span>The 1–10 ranked ladder · PLC</span>
              <span>Entry → Expert</span>
            </div>
            <div className="rungs">
              {plcLadder.map((rung) => {
                const h = 12 + ((rung.rank - 1) * (88 - 12)) / 9;
                return (
                  <div key={rung.rank} className={`rung ${rung.status}`} title={rung.title}>
                    <span className="rung-fill" style={{ height: `${h}%` }} />
                    <b>{rung.rank}</b>
                  </div>
                );
              })}
            </div>
            <div className="ladder-key">
              <span><i className="k-fill" />Higher rung = more subsystems, faults &amp; safety stakes</span>
              <span><i className="k-plain" />Same scale a learner climbs and an interviewer selects from</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trades */}
      <section id="trades">
        <div className="wrap sec">
          <span className="eyebrow">Built to expand</span>
          <h2 className="sec-title">PLC first — then the whole trade.</h2>
          <p className="sub">Each new trade plugs in as a module: its devices, its exercises, its assessment rubric. PLC &amp; industrial automation leads; more hands-on trades follow.</p>
          <div className="trades-grid">
            {trades.map((t) => {
              const live = t.status === 'available';
              const inner = (
                <>
                  <span className="trade-ic">{TRADE_ICON[t.id]}</span>
                  <h3>{t.name}</h3>
                  <span className={`trade-status ${live ? 'live' : 'soon'}`}>{live ? '● Available' : 'Coming soon'}</span>
                </>
              );
              return live ? (
                <Link key={t.id} to={`/trade/${t.id}`} className="trade-card is-live">{inner}</Link>
              ) : (
                <div key={t.id} className="trade-card">{inner}</div>
              );
            })}
          </div>

          <div className="honest-note">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l9 16H3L12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 10v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="16.6" r="1" fill="currentColor" /></svg>
            <p>An educational simulator, honest about its limits. It models the real categories of work — programming, wiring, diagnosis, commissioning — but is never a safety-rated controller or a substitute for certified, live-work training. The limits are always stated, never hidden.</p>
          </div>
        </div>
      </section>

      {/* Closer */}
      <section className="band-ink closer">
        <div className="wrap">
          <h2 className="sec-title">Stop guessing who can do the work.</h2>
          <p className="sub closer-sub">Whether you're learning the trade or hiring for it, {BRAND.name} lets the work speak for itself.</p>
          <div className="cta-row closer-cta">
            <Link className="btn primary" to="/trades">I'm learning</Link>
            <Link className="btn ghost ghost-on-ink" to="/employer">I'm hiring</Link>
          </div>
        </div>
      </section>

      <footer className="site-foot">
        <div className="wrap wrap-wide foot-inner">
          <span>{BRAND.name}</span>
          <span>Virtual trade simulator &amp; practical assessment · Educational use</span>
        </div>
      </footer>
    </>
  );
}
