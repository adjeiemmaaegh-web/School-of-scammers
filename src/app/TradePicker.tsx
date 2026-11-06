import { Link } from 'react-router-dom';
import { allTrades } from '../trades/registry';
import { AppHeader } from '../ui/AppHeader';

export function TradePicker() {
  const trades = allTrades();
  return (
    <>
      <AppHeader />
      <main id="main" className="wrap wrap-wide page">
        <nav className="crumbs"><Link to="/">Home</Link><span>/</span><strong>Choose a trade</strong></nav>
        <span className="eyebrow">Choose a trade</span>
        <h1 className="page-title">What do you want to practice?</h1>
        <p className="sub">PLC &amp; automation is available now. More hands-on trades are on the way — each arrives as a full module with its own 1–10 exercise ladder.</p>

        <div className="picker-grid">
          {trades.map((t) => {
            const live = t.status === 'available';
            const body = (
              <>
                <div className="picker-top">
                  <h2>{t.name}</h2>
                  <span className={`trade-status ${live ? 'live' : 'soon'}`}>{live ? '● Available' : 'Coming soon'}</span>
                </div>
                <p>{t.blurb}</p>
                {live && <span className="picker-go">Open ladder →</span>}
              </>
            );
            return live ? (
              <Link key={t.id} to={`/trade/${t.id}`} className="picker-card is-live">{body}</Link>
            ) : (
              <div key={t.id} className="picker-card">{body}</div>
            );
          })}
        </div>
      </main>
    </>
  );
}
