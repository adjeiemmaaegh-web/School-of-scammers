import { describe, expect, it } from 'vitest';
import { orthographicZoomFor, SANDBOX_FOV_DEG } from '../src/render/workcell-camera';

describe('R6.2 orthographic inspection view', () => {
  it('shows the same scene height at the target as the perspective camera from the same distance', () => {
    const d = 6, viewport = 600;
    const perspectiveHeight = 2 * d * Math.tan((SANDBOX_FOV_DEG * Math.PI) / 360);
    const zoom = orthographicZoomFor(d, viewport);
    expect(viewport / zoom).toBeCloseTo(perspectiveHeight, 6);       // orthographic visible height = viewport px / zoom
  });
  it('a farther framing zooms out, a taller viewport zooms in, and the result is clamped', () => {
    expect(orthographicZoomFor(10, 600)).toBeLessThan(orthographicZoomFor(5, 600));
    expect(orthographicZoomFor(5, 900)).toBeGreaterThan(orthographicZoomFor(5, 600));
    expect(orthographicZoomFor(0, 600)).toBeLessThanOrEqual(2000);
    expect(orthographicZoomFor(1e6, 600)).toBe(5);
  });
});
import { labelDistanceFactor } from '../src/render/label-scale';
describe('R6.2 labels in the orthographic view', () => {
  it('divides the distance factor by the viewport height under an orthographic camera only', () => {
    expect(labelDistanceFactor(11, false, 664)).toBe(11);
    expect(labelDistanceFactor(11, true, 664)).toBeCloseTo(11 / 664, 9);
    // the on-screen scale then matches perspective at the framed distance: zoom * df_ortho == df / (2 tan(fov/2) d)
    const d = 5, h = 664, zoom = orthographicZoomFor(d, h);
    expect(zoom * labelDistanceFactor(11, true, h)).toBeCloseTo(11 / (2 * d * Math.tan((SANDBOX_FOV_DEG * Math.PI) / 360)), 6);
    expect(labelDistanceFactor(11, true, 0)).toBe(11);    // degenerate viewport: never divides by zero
  });
});
