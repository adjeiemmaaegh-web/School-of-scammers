import { Link } from 'react-router-dom';
import { AppHeader } from '../ui/AppHeader';

/** Assessments & Interviews: a separate, secondary module. It runs on the simulator; it does not shape it. */
export function AssessPage() {
  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <nav className="crumbs"><Link to="/">Home</Link><span>/</span><strong>Assessments</strong></nav>
        <span className="eyebrow">Assessments &amp; interviews</span>
        <h1 className="page-title">Practical tests built on the simulator</h1>
        <p className="sub">An employer or interviewer picks a task, sends it to a candidate, and reviews an evidence-backed result. This is an optional module; the simulator and the learning section do not depend on it.</p>

        <div className="hub-cards">
          <Link to="/employer" className="hub-card" data-assess="employer"><h2>For employers &amp; interviewers</h2><p>Choose an exercise or simulator scenario, generate an assignment link, and review a returned result code.</p><span className="go">Set up a test →</span></Link>
          <Link to="/take" className="hub-card" data-assess="candidate"><h2>For candidates</h2><p>Open the task you were assigned with the link or code you received. You can also practise first in the simulator.</p><span className="go">Open an assigned task →</span></Link>
          <Link to="/sandbox" className="hub-card"><h2>Practise first</h2><p>The same simulator the tasks run on is free to use, with nothing recorded or graded.</p><span className="go">Open the simulator →</span></Link>
        </div>

        <div className="limits">
          <strong>Honest limits.</strong> Everything runs in the browser with no server, so a result code is not tamper-proof and should be treated as an interview aid, not a certificate or proof of identity. The simulator is educational and not safety-rated.
        </div>
      </main>
    </>
  );
}
