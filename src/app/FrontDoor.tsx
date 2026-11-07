import { Link } from 'react-router-dom';
import { BRAND } from '../platform/config';
import { AppHeader } from '../ui/AppHeader';

/**
 * Home. The simulator is the product; learning and assessments are separate, secondary sections.
 * Every claim on this page is something the simulator does today. Limits are stated, not hidden.
 */
export function FrontDoor() {
  return (
    <>
      <AppHeader />

      <main id="main" tabIndex={-1}>
      <section id="hero" className="hero">
        <div className="wrap wrap-wide hero-grid">
          <div>
            <span className="eyebrow">Virtual industrial automation laboratory</span>
            <h1 className="hero-title">
              Build, wire, program<br />
              and <span className="amber">run</span> a virtual factory.
            </h1>
            <p className="lede">{BRAND.shortPitch} Think Cisco Packet Tracer, for industrial automation.</p>
            <div className="cta-row">
              <Link className="btn primary" to="/sandbox" data-cta="simulator">Open the simulator →</Link>
              <Link className="btn ghost" to="/learn">Learn &amp; practice</Link>
            </div>
            <div className="tagstrip">
              <span className="chip">Open 3D workspace</span>
              <span className="chip">Several PLCs and panels</span>
              <span className="chip">Faults and a virtual multimeter</span>
              <span className="chip">Saved in your browser · no hardware</span>
            </div>
          </div>

          <figure className="schematic">
            <figcaption className="schematic-cap">
              <span>Start/stop rung · running in the simulator</span>
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
            <p className="schematic-foot">Not a script: every lamp and motor in the simulator follows what the scan engine and the wiring actually do.</p>
          </figure>
        </div>
      </section>

      <section id="simulator" className="band">
        <div className="wrap sec">
          <span className="eyebrow">The simulator</span>
          <h2 className="sec-title">Start from an empty floor. Build whatever you can wire.</h2>
          <p className="sub">You are not picking a scenario. You place equipment, connect it terminal by terminal, program the controllers and run it. What happens is what your wiring and your logic actually do.</p>
          <div className="cap-grid">
            <div className="cap"><h3>Open 3D workspace</h3><p>Place, move and remove devices on a 3D floor; add a ready-made starter panel when you want a head start.</p><span className="tag">drag · click · Delete · Undo</span></div>
            <div className="cap"><h3>Terminal-level wiring</h3><p>Connect individual terminals of supplies, PLCs, buttons, contactors, sensors and loads. Separate supplies stay isolated until you tie their commons.</p><span className="tag">24 V DC · virtual multimeter</span></div>
            <div className="cap"><h3>Several PLCs, each programmed</h3><p>Up to six controllers, each with its own Ladder or Structured Text program, I/O and scan. Wire one PLC's output into another's input.</p><span className="tag">Ladder · Structured Text</span></div>
            <div className="cap"><h3>A real scan engine</h3><p>A deterministic scan runs your actual logic against a live plant: motors, a conveyor with parcels and a mark sensor, a tank with a pump, level switch and valve.</p><span className="tag">run · pause · step · breakpoints</span></div>
            <div className="cap"><h3>Break it, measure it, fix it</h3><p>Inject open wires, dead coils, welded contacts and stuck sensors, read the alarms, measure with the meter and replace the faulty part.</p><span className="tag">faults · alarms · repair</span></div>
            <div className="cap"><h3>Yours, in your browser</h3><p>Your project saves locally and exports as JSON. No account, no server, no install.</p><span className="tag">frontend-only</span></div>
          </div>
          <div className="limits">
            <strong>Where it is today.</strong> This is a bounded, educational 24 V simulator, not a model of any vendor's PLC and never safety-rated. Today there is one conveyor, one tank and one protection set per project, the PLC has a fixed five-input, six-output layout, and there is no Function Block Diagram editor yet. Widening the equipment and the I/O is the current engineering priority.
          </div>
          <div className="cta-row" style={{ marginTop: 22 }}>
            <Link className="btn primary" to="/sandbox">Open the simulator →</Link>
          </div>
        </div>
      </section>

      <section id="learn">
        <div className="wrap sec">
          <span className="eyebrow">Learn &amp; practice</span>
          <h2 className="sec-title">Tutorials and scenarios that run on the same engine.</h2>
          <p className="sub">Prefer a guided start? These run on the real simulation, and you can leave for the open simulator at any time.</p>
          <div className="hub-cards">
            <Link to="/trades" className="hub-card"><h3>Guided exercises</h3><p>A ranked 1&ndash;10 ladder of hands-on PLC tasks, from a first start/stop to a commissioned line.</p><span className="go">Open the ladder →</span></Link>
            <Link to="/trade/plc" className="hub-card"><h3>Simulator scenarios</h3><p>Work orders you complete in the 3D simulator: build a starter, find a hidden fault, program a sorting line or a tank.</p><span className="go">See the scenarios →</span></Link>
            <Link to="/labs" className="hub-card"><h3>Engineering labs</h3><p>Focused bench tools: star&ndash;delta, pneumatics, analog process control, a 24 V bench and a DC circuit lab.</p><span className="go">Open the labs →</span></Link>
          </div>
        </div>
      </section>

      <section id="assessments" className="band secondary-band">
        <div className="wrap sec">
          <span className="eyebrow">Assessments &amp; interviews</span>
          <h2 className="sec-title">Also here: practical tests for employers.</h2>
          <p className="sub">An employer can pick a simulator task and send it to a candidate, who completes it under exam conditions and returns a result code. This is a separate, secondary module and does not affect the simulator.</p>
          <div className="cta-row">
            <Link className="btn ghost" to="/assess">About assessments</Link>
          </div>
        </div>
      </section>

      </main>
      <footer className="site-foot">
        <div className="wrap wrap-wide foot-inner">
          <span>{BRAND.name}</span>
          <span>Virtual industrial automation laboratory · Educational simulation, not safety-rated</span>
        </div>
      </footer>
    </>
  );
}
