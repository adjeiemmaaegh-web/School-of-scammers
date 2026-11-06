/**
 * Device-art library — reusable, theme-aware SVG illustrations of real equipment.
 *
 * Each component returns an SVG <g> positioned by {x, y, scale}, drawn in local
 * coordinates, so it can be dropped into any scene <svg>. Colours come from the
 * scene tokens (theme.css) and shading from the gradients in <DeviceDefs/>, which
 * every scene using this art must render once inside its <svg>.
 */
import type { ReactNode } from 'react';

interface Placed {
  x?: number;
  y?: number;
  scale?: number;
}
const place = ({ x = 0, y = 0, scale = 1 }: Placed) => `translate(${x},${y}) scale(${scale})`;

/** Gradient/paint definitions. Render once per scene <svg>. */
export function DeviceDefs() {
  return (
    <defs>
      <linearGradient id="da-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--scene-metal-hi)" />
        <stop offset="0.5" stopColor="var(--scene-steel)" />
        <stop offset="1" stopColor="var(--scene-metal-lo)" />
      </linearGradient>
      <linearGradient id="da-metal-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="var(--scene-metal-hi)" />
        <stop offset="0.5" stopColor="var(--scene-steel)" />
        <stop offset="1" stopColor="var(--scene-metal-lo)" />
      </linearGradient>
      <linearGradient id="da-belt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--scene-belt-2)" />
        <stop offset="1" stopColor="var(--scene-belt-1)" />
      </linearGradient>
      <radialGradient id="da-lens" cx="0.5" cy="0.42" r="0.6">
        <stop offset="0" stopColor="var(--scene-steel)" />
        <stop offset="0.55" stopColor="var(--scene-lens)" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <radialGradient id="da-glass" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="var(--scene-metal-hi)" stopOpacity="0.9" />
        <stop offset="0.6" stopColor="var(--scene-glass)" stopOpacity="0.55" />
        <stop offset="1" stopColor="var(--scene-lens)" stopOpacity="0.7" />
      </radialGradient>
    </defs>
  );
}

const LINE = 'var(--scene-line)';

/** Electric motor with cooling fins, end bell, shaft and terminal box. */
export function MotorArt({ running = false, ...p }: Placed & { running?: boolean }) {
  return (
    <g transform={place(p)}>
      <ellipse cx="48" cy="70" rx="46" ry="7" fill="var(--scene-shadow)" />
      {/* feet */}
      <rect x="14" y="60" width="16" height="10" rx="2" fill="var(--scene-metal-lo)" stroke={LINE} />
      <rect x="66" y="60" width="16" height="10" rx="2" fill="var(--scene-metal-lo)" stroke={LINE} />
      {/* body */}
      <rect x="10" y="20" width="72" height="44" rx="12" fill="url(#da-metal)" stroke={LINE} strokeWidth="1.5" />
      {/* cooling fins */}
      {[22, 30, 38, 46, 54, 62, 70].map((x) => (
        <line key={x} x1={x} y1="24" x2={x} y2="60" stroke="var(--scene-metal-lo)" strokeWidth="1.4" opacity="0.6" />
      ))}
      {/* terminal box */}
      <rect x="34" y="10" width="24" height="14" rx="2" fill="var(--scene-steel)" stroke={LINE} />
      {/* end bell */}
      <ellipse cx="82" cy="42" rx="9" ry="22" fill="url(#da-metal-h)" stroke={LINE} strokeWidth="1.5" />
      {/* shaft + rotation */}
      <rect x="90" y="38" width="16" height="8" rx="2" fill="var(--scene-steel)" stroke={LINE} />
      <g className={running ? 'da-spin' : ''} style={{ transformOrigin: '34px 42px' }}>
        <circle cx="34" cy="42" r="8" fill="none" stroke="var(--scene-metal-hi)" strokeWidth="2" />
        <line x1="34" y1="34" x2="34" y2="50" stroke="var(--scene-metal-hi)" strokeWidth="2" />
      </g>
      {/* run LED */}
      <circle cx="62" cy="17" r="2.6" fill={running ? 'var(--ok)' : 'var(--scene-dim)'} />
    </g>
  );
}

/** Belt conveyor with rollers, legs and (optionally moving) tread. */
export function ConveyorArt({ running = false, length = 300, ...p }: Placed & { running?: boolean; length?: number }) {
  const treads = [];
  for (let x = 30; x < length - 10; x += 34) treads.push(x);
  return (
    <g transform={place(p)}>
      <ellipse cx={length / 2} cy="74" rx={length / 2} ry="9" fill="var(--scene-shadow)" />
      {/* frame */}
      <rect x="18" y="26" width={length - 36} height="26" rx="13" fill="url(#da-belt)" stroke={LINE} strokeWidth="1.5" />
      {/* end rollers */}
      <circle cx="22" cy="39" r="18" fill="url(#da-metal)" stroke={LINE} strokeWidth="1.5" />
      <circle cx={length - 22} cy="39" r="18" fill="url(#da-metal)" stroke={LINE} strokeWidth="1.5" />
      <circle cx="22" cy="39" r="4" fill="var(--scene-metal-lo)" />
      <circle cx={length - 22} cy="39" r="4" fill="var(--scene-metal-lo)" />
      {/* tread marks */}
      <g className={running ? 'da-belt-move' : ''}>
        {treads.map((x) => (
          <line key={x} x1={x} y1="28" x2={x} y2="50" stroke="var(--scene-tread)" strokeWidth="2.5" />
        ))}
      </g>
      {/* legs */}
      <rect x="40" y="52" width="7" height="20" fill="var(--scene-steel)" stroke={LINE} />
      <rect x={length - 47} y="52" width="7" height="20" fill="var(--scene-steel)" stroke={LINE} />
    </g>
  );
}

/** Parcel/carton box. */
export function ParcelArt({ ...p }: Placed) {
  return (
    <g transform={place(p)}>
      <rect x="0" y="0" width="34" height="30" rx="2.5" fill="var(--scene-parcel)" stroke={LINE} strokeWidth="1.2" />
      <line x1="17" y1="0" x2="17" y2="30" stroke={LINE} strokeWidth="1.2" />
      <path d="M4 10 h26" stroke={LINE} strokeWidth="1" opacity="0.5" />
    </g>
  );
}

/** Photoeye sensor with mounting bracket and beam. */
export function PhotoeyeArt({ healthy = true, beamLen = 36, ...p }: Placed & { healthy?: boolean; beamLen?: number }) {
  const col = healthy ? 'var(--ok)' : 'var(--crit)';
  return (
    <g transform={place(p)}>
      <rect x="-3" y="-2" width="6" height="14" fill="var(--scene-steel)" stroke={LINE} />
      <rect x="0" y="0" width="24" height="18" rx="3" fill="url(#da-metal-h)" stroke={LINE} strokeWidth="1.3" />
      <circle cx="18" cy="9" r="4" fill={col} stroke={LINE} strokeWidth="0.8" />
      <line x1="18" y1="18" x2="18" y2={18 + beamLen} stroke={col} strokeWidth="2" strokeDasharray="4 3" opacity="0.8" />
    </g>
  );
}

/** Three-stack signal tower (red / amber / green). */
export function StackLightArt({ red = false, amber = false, green = false, ...p }: Placed & { red?: boolean; amber?: boolean; green?: boolean }) {
  const dome = (cy: number, on: boolean, color: string) => (
    <g>
      <path d={`M-9 ${cy} a9 9 0 0 1 18 0 z`} fill={on ? color : 'var(--scene-dim)'} opacity={on ? 1 : 0.5} stroke={LINE} strokeWidth="1" />
      {on && <ellipse cx="-3" cy={cy - 4} rx="3" ry="2" fill="#fff" opacity="0.5" />}
    </g>
  );
  return (
    <g transform={place(p)}>
      <rect x="-3" y="54" width="6" height="22" fill="var(--scene-steel)" stroke={LINE} />
      <g transform="translate(0,54)">{dome(0, red, 'var(--crit)')}</g>
      <g transform="translate(0,36)">{dome(0, amber, 'var(--warn)')}</g>
      <g transform="translate(0,18)">{dome(0, green, 'var(--ok)')}</g>
    </g>
  );
}

/** Contactor (coil block) with pull-in indicator. */
export function ContactorArt({ energized = false, label, ...p }: Placed & { energized?: boolean; label?: string }) {
  return (
    <g transform={place(p)}>
      <rect x="0" y="0" width="60" height="70" rx="8" fill="url(#da-metal)" stroke={energized ? 'var(--ok)' : LINE} strokeWidth={energized ? 2.2 : 1.4} />
      <rect x="10" y="10" width="40" height="20" rx="3" fill="var(--scene-metal-lo)" stroke={LINE} />
      <circle cx="30" cy="46" r="11" fill="none" stroke={energized ? 'var(--ok)' : 'var(--scene-dim)'} strokeWidth="3" />
      {[16, 30, 44].map((x) => (
        <rect key={x} x={x - 2} y="60" width="4" height="8" fill="var(--scene-steel)" />
      ))}
      {label && <text x="30" y="24" textAnchor="middle" className="scene-label" fill="var(--ink)">{label}</text>}
    </g>
  );
}

/** CCTV camera — bullet or dome — with lens, sunshield/IR and bracket. */
export function CameraArt({ kind = 'bullet', on = true, ...p }: Placed & { kind?: 'bullet' | 'dome'; on?: boolean }) {
  if (kind === 'dome') {
    return (
      <g transform={place(p)}>
        <ellipse cx="30" cy="30" rx="30" ry="9" fill="var(--scene-metal-lo)" stroke={LINE} />
        <path d="M2 30 a28 20 0 0 1 56 0 z" fill="url(#da-glass)" stroke={LINE} strokeWidth="1.4" />
        <circle cx="30" cy="26" r="8" fill="url(#da-lens)" stroke={LINE} strokeWidth="0.8" />
        <circle cx="30" cy="26" r="3" fill="var(--scene-lens)" />
        <circle cx="33" cy="23" r="1.6" fill="#fff" opacity="0.6" />
        <circle cx="48" cy="34" r="2.2" fill={on ? 'var(--ok)' : 'var(--scene-dim)'} />
      </g>
    );
  }
  return (
    <g transform={place(p)}>
      {/* bracket */}
      <path d="M4 8 v34 M4 42 h10" fill="none" stroke="var(--scene-steel)" strokeWidth="4" strokeLinecap="round" />
      {/* body */}
      <rect x="14" y="20" width="60" height="26" rx="13" fill="url(#da-metal-h)" stroke={LINE} strokeWidth="1.4" />
      {/* sunshield */}
      <rect x="18" y="15" width="52" height="9" rx="4" fill="var(--scene-steel)" stroke={LINE} />
      {/* lens / IR ring */}
      <circle cx="74" cy="33" r="13" fill="url(#da-lens)" stroke={LINE} strokeWidth="1.4" />
      <circle cx="74" cy="33" r="9" fill="none" stroke={on ? 'color-mix(in srgb, var(--crit) 55%, transparent)' : 'var(--scene-dim)'} strokeWidth="2" />
      <circle cx="74" cy="33" r="4.5" fill="var(--scene-lens)" />
      <circle cx="77" cy="30" r="1.8" fill="#fff" opacity="0.6" />
      {/* status LED */}
      <circle cx="24" cy="33" r="2.4" fill={on ? 'var(--ok)' : 'var(--scene-dim)'} />
    </g>
  );
}

/** NVR / recorder (1U) with drive bays and LEDs. */
export function NvrArt({ online = true, ...p }: Placed & { online?: boolean }) {
  return (
    <g transform={place(p)}>
      <ellipse cx="55" cy="40" rx="54" ry="6" fill="var(--scene-shadow)" />
      <rect x="2" y="4" width="106" height="34" rx="5" fill="url(#da-metal)" stroke={LINE} strokeWidth="1.5" />
      {[10, 30, 50].map((x) => (
        <rect key={x} x={x} y="10" width="16" height="22" rx="2" fill="var(--scene-metal-lo)" stroke={LINE} />
      ))}
      <circle cx="80" cy="14" r="2.4" fill={online ? 'var(--ok)' : 'var(--crit)'} />
      <circle cx="80" cy="22" r="2.4" fill="var(--scene-steel)" />
      <circle cx="80" cy="30" r="2.4" fill="var(--scene-steel)" />
      <text x="96" y="25" textAnchor="middle" className="scene-label">NVR</text>
    </g>
  );
}

/** PoE switch with a row of RJ45 ports and link LEDs. */
export function SwitchArt({ ports = 8, lit = 0, ...p }: Placed & { ports?: number; lit?: number }) {
  return (
    <g transform={place(p)}>
      <ellipse cx="60" cy="34" rx="58" ry="6" fill="var(--scene-shadow)" />
      <rect x="2" y="6" width="116" height="28" rx="5" fill="url(#da-metal)" stroke={LINE} strokeWidth="1.5" />
      {Array.from({ length: ports }).map((_, i) => {
        const x = 10 + i * 13;
        const on = i < lit;
        return (
          <g key={i}>
            <rect x={x} y="16" width="10" height="11" rx="1.5" fill="var(--scene-lens)" stroke={LINE} strokeWidth="0.7" />
            <circle cx={x + 5} cy="12" r="1.8" fill={on ? 'var(--ok)' : 'var(--scene-dim)'} />
          </g>
        );
      })}
    </g>
  );
}

/** Wrap scene content with the device defs. */
export function Scene({ viewBox, label, children }: { viewBox: string; label: string; children: ReactNode }) {
  return (
    <svg className="plc-scene" viewBox={viewBox} role="img" aria-label={label}>
      <DeviceDefs />
      {children}
    </svg>
  );
}
