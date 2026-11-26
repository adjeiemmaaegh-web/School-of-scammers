import { useThree } from '@react-three/fiber';

/**
 * drei `Html` labels with `distanceFactor` scale by 1/(2·tan(fov/2)·distance) under a perspective camera but by `camera.zoom`
 * under an orthographic one — about the viewport height in pixels larger at the same framing. This returns the distance
 * factor to pass so a label keeps the same on-screen size in both projections (R6.2 orthographic view).
 */
export function labelDistanceFactor(base: number, orthographic: boolean, viewportHeightPx: number): number {
  return orthographic ? base / Math.max(1, viewportHeightPx) : base;
}
export function useLabelDistanceFactor(base: number): number {
  const orthographic = useThree(s => (s.camera as { isOrthographicCamera?: boolean }).isOrthographicCamera === true);
  const height = useThree(s => s.size.height);
  return labelDistanceFactor(base, orthographic, height);
}
