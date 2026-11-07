import React, { Suspense } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { FrontDoor } from './FrontDoor';
import { TradePicker } from './TradePicker';
import { TradeLadder } from './TradeLadder';
import { ExercisePage } from './ExercisePage';
import { EmployerPage } from './EmployerPage';
import { CandidatePage } from './CandidatePage';
import { AppHeader } from '../ui/AppHeader';
const SandboxPage = React.lazy(() => import('./SandboxPage').then(m => ({ default: m.SandboxPage })));

/* Legacy engine lab surfaces — kept reachable under /labs/* so the salvaged
   simulation engine stays exercised and nothing is orphaned during the rebuild. */
const EngineeringWorkbench = React.lazy(() => import('../components/EngineeringWorkbench').then((m) => ({ default: m.EngineeringWorkbench })));
const AssessmentSuite = React.lazy(() => import('../components/AssessmentSuite').then((m) => ({ default: m.AssessmentSuite })));
const ProcessControlLab = React.lazy(() => import('../components/ProcessControlLab').then((m) => ({ default: m.ProcessControlLab })));
const StarDeltaLab = React.lazy(() => import('../components/StarDeltaLab').then((m) => ({ default: m.StarDeltaLab })));
const WorkcellComposer = React.lazy(() => import('../components/WorkcellComposer').then((m) => ({ default: m.WorkcellComposer })));
const PneumaticLab = React.lazy(() => import('../components/PneumaticLab').then((m) => ({ default: m.PneumaticLab })));
const DcNetworkLab = React.lazy(() => import('../components/DcNetworkLab').then((m) => ({ default: m.DcNetworkLab })));
const ElectricalBenchLab = React.lazy(() => import('../components/ElectricalBenchLab').then((m) => ({ default: m.ElectricalBenchLab })));

const LEGACY_LABS = [
  { path: 'engineering', label: 'PLC & wiring studio', detail: 'Ladder editor, scan debugger, I/O and wiring bench.' },
  { path: 'process-control', label: 'Analog & Structured Text', detail: 'Tank level, PID tuning and a bounded ST runtime.' },
  { path: 'starter', label: 'Star–delta starter', detail: 'Three-contactor sequencing and interlock faults.' },
  { path: 'pneumatics', label: 'Pneumatic cylinder', detail: 'Double-acting cylinder commissioning and faults.' },
  { path: 'workcell', label: 'Factory scene composer', detail: 'Place industrial devices and run normalized scans.' },
  { path: 'electrical-bench', label: '24V wiring bench', detail: 'Patch circuits and probe with a virtual multimeter.' },
  { path: 'dc-circuit', label: 'DC circuit engineering', detail: 'Resistor networks, nodal analysis and meter readings.' },
  { path: 'assessments', label: 'Assessment suite', detail: 'Deterministic behavioral test harness.' },
];

function LegacyFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader right={<Link className="btn ghost small" to="/labs">← Engine tools</Link>} />
      <main id="main" className="wrap wrap-wide page legacy-frame">
        <div className="legacy-banner">
          Engine tool — part of the original simulation engine, being folded into ranked exercises.
        </div>
        <Suspense fallback={<div className="panel">Loading engine tool…</div>}>{children}</Suspense>
      </main>
    </>
  );
}

function LegacyIndex() {
  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <nav className="crumbs"><Link to="/">Home</Link><span>/</span><strong>Engine tools</strong></nav>
        <span className="eyebrow">Engine tools</span>
        <h1 className="page-title">Direct simulation tools</h1>
        <p className="sub">These are the raw engine surfaces from the simulation core. They're being wrapped into the ranked exercise ladder — for now they remain available directly.</p>
        <div className="picker-grid">
          {LEGACY_LABS.map((l) => (
            <Link key={l.path} to={`/labs/${l.path}`} className="picker-card is-live">
              <div className="picker-top"><h2>{l.label}</h2></div>
              <p>{l.detail}</p>
              <span className="picker-go">Open tool →</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

function NotFound() {
  return (
    <>
      <AppHeader />
      <main id="main" className="wrap page narrow">
        <h1 className="page-title">Page not found</h1>
        <Link className="btn primary" to="/">Return home →</Link>
      </main>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main" onClick={() => {
        // Main landmarks are not natively focusable; support keyboard skip navigation.
        const main = document.getElementById('main');
        if (main) { main.setAttribute('tabindex', '-1'); main.focus(); }
      }}>Skip to main content</a>
      <Routes>
        <Route path="/" element={<FrontDoor />} />
        <Route path="/sandbox" element={<Suspense fallback={<main id="main" className="wrap wrap-wide page">
          <p role="status">Loading the 3D engineering workbench…</p>
        </main>}><SandboxPage /></Suspense>} />
        <Route path="/trades" element={<TradePicker />} />
        <Route path="/trade/:tradeId" element={<TradeLadder />} />
        <Route path="/exercise/:exerciseId" element={<ExercisePage />} />
        <Route path="/employer" element={<EmployerPage />} />
        <Route path="/take" element={<CandidatePage />} />

        <Route path="/labs" element={<LegacyIndex />} />
        <Route path="/labs/engineering" element={<LegacyFrame><EngineeringWorkbench /></LegacyFrame>} />
        <Route path="/labs/process-control" element={<LegacyFrame><ProcessControlLab /></LegacyFrame>} />
        <Route path="/labs/starter" element={<LegacyFrame><StarDeltaLab /></LegacyFrame>} />
        <Route path="/labs/pneumatics" element={<LegacyFrame><PneumaticLab /></LegacyFrame>} />
        <Route path="/labs/workcell" element={<LegacyFrame><WorkcellComposer /></LegacyFrame>} />
        <Route path="/labs/electrical-bench" element={<LegacyFrame><ElectricalBenchLab /></LegacyFrame>} />
        <Route path="/labs/dc-circuit" element={<LegacyFrame><DcNetworkLab /></LegacyFrame>} />
        <Route path="/labs/assessments" element={<LegacyFrame><AssessmentSuite /></LegacyFrame>} />

        {/* redirects from old top-level engine paths */}
        <Route path="/engineering" element={<Navigate to="/labs/engineering" replace />} />
        <Route path="/simulation" element={<Navigate to="/exercise/plc-conveyor-start" replace />} />
        <Route path="/assessments" element={<Navigate to="/labs/assessments" replace />} />
        <Route path="/process-control" element={<Navigate to="/labs/process-control" replace />} />
        <Route path="/starter-lab" element={<Navigate to="/labs/starter" replace />} />
        <Route path="/pneumatics" element={<Navigate to="/labs/pneumatics" replace />} />
        <Route path="/workcell-composer" element={<Navigate to="/labs/workcell" replace />} />
        <Route path="/electrical-bench" element={<Navigate to="/labs/electrical-bench" replace />} />
        <Route path="/dc-circuit" element={<Navigate to="/labs/dc-circuit" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
