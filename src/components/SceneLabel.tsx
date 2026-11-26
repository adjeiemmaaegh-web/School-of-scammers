import type { ReactNode } from 'react';
import { Html } from '@react-three/drei';

/**
 * A lightweight 3D-anchored text label for the legacy lab scenes. It replaces drei's SDF `Text` (troika-three-text,
 * bidi-js and an SDF generator, about 35 KB gzip) with a DOM overlay drawn at the same anchor. `size` is the old
 * world-unit font size; the label scales with camera distance like the original.
 */
export function SceneLabel({ position, size, color, children }: {
  position: [number, number, number]; size: number; color: string; children: ReactNode;
}) {
  return <Html center position={position} distanceFactor={6} zIndexRange={[10, 0]}
    style={{ color, fontSize: `${Math.round(size * 160)}px`, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none',
      textShadow: color === '#0f172a' ? 'none' : '0 1px 2px rgba(0,0,0,.6)', fontFamily: 'inherit', userSelect: 'none' }}>
    {children}
  </Html>;
}
