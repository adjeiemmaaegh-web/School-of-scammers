import { Link, NavLink } from 'react-router-dom';
import { BRAND } from '../platform/config';
import { useTheme } from './useTheme';

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect x="1.2" y="1.2" width="31.6" height="31.6" rx="8" fill="var(--accent)" />
      <path
        d="M8 11h4M8 23h4M22 11h4M22 23h4M12 11v12M22 11v12"
        stroke="var(--accent-ink)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="17" cy="17" r="3.1" fill="none" stroke="var(--accent-ink)" strokeWidth="2.1" />
    </svg>
  );
}

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const { toggle } = useTheme();
  return (
    <header className="app-header">
      <div className="wrap wrap-wide app-header-inner">
        <Link to="/" className="brand">
          <BrandMark />
          <span>{BRAND.name}</span>
        </Link>
        {/* The product has one primary experience (the simulator) and two secondary sections. */}
        <nav className="primary-nav" aria-label="Primary">
          <NavLink to="/sandbox" className={({ isActive }) => `pn-link pn-sim${isActive ? ' is-active' : ''}`}>Simulator</NavLink>
          <NavLink to="/learn" className={({ isActive }) => `pn-link${isActive ? ' is-active' : ''}`}>Learn &amp; Practice</NavLink>
          <NavLink to="/assess" className={({ isActive }) => `pn-link pn-secondary${isActive ? ' is-active' : ''}`}>Assessments</NavLink>
        </nav>
        <div className="app-header-right">
          {right}
          <button className="theme-btn" onClick={toggle} aria-label="Toggle light and dark theme">
            ◐
          </button>
        </div>
      </div>
    </header>
  );
}
