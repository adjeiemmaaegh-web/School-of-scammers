import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../src/components/registry';
import { modelLimitFor } from '../src/components/model-limits';

describe('R7.6 model limits', () => {
  it('every registered kind gets a limit sentence that disclaims calibration and safety', () => {
    for (const kind of Object.keys(COMPONENTS)) {
      const text = modelLimitFor(kind);
      expect(text, kind).toMatch(/not calibrated, certified or safety-rated/);
      expect(text, kind).not.toMatch(/realistic|accurate|certified for/i);
    }
  });
  it('key devices have specific limits', () => {
    expect(modelLimitFor('cylinder')).toMatch(/air is assumed available/);
    expect(modelLimitFor('estop')).toMatch(/not a safety-rated E-stop/);
    expect(modelLimitFor('belt-conveyor')).toMatch(/Kinematic belt/);
  });
});
