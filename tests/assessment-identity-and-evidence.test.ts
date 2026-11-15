import { describe, expect, it } from 'vitest';
import { isIssuedAssessmentCompatible, preserveIssuedAssignment } from '../src/platform/assessment-integrity';
import { appendBoundedEvidence, MAX_EVIDENCE_EVENTS } from '../src/platform/evidence-log';
import { encodeResult, decodeResult } from '../src/platform/persistence';
import type { Assignment, AttemptResult } from '../src/platform/types';

const issued: Assignment = {
  kind: 'skills-lab-assignment', formatVersion: 1, trade: 'plc',
  exerciseId: 'plc-conveyor-start', exerciseVersion: '1.0',
  mode: 'assessment', seed: 42, label: 'Employer-issued ✓',
  createdAt: '2026-11-15T00:00:00.000Z',
};
const generated: AttemptResult = {
  kind: 'skills-lab-result', formatVersion: 1,
  assignment: { ...issued, createdAt: '2026-11-15T00:01:00.000Z', label: undefined },
  startedAt: '2026-11-15T00:01:00.000Z',
  finishedAt: '2026-11-15T00:02:00.000Z', durationMs: 60000, evidence: [],
  rubric: { score: 8, max: 10, passed: true, safetyHold: false,
    criteria: [{ id: 'test', label: 'Control', max: 10, earned: 8, reason: 'Simulated' }] },
};
describe('candidate assignment and result binding', () => {
  it('accepts only the assigned trade, mode, id and version', () => {
    const def = { id: issued.exerciseId, trade: issued.trade, version: issued.exerciseVersion };
    expect(isIssuedAssessmentCompatible(issued, def)).toBe(true);
    expect(isIssuedAssessmentCompatible({ ...issued, trade: 'cctv' }, def)).toBe(false);
    expect(isIssuedAssessmentCompatible({ ...issued, mode: 'learning' }, def)).toBe(false);
    expect(isIssuedAssessmentCompatible({ ...issued, exerciseVersion: '0.9' }, def)).toBe(false);
    expect(isIssuedAssessmentCompatible({ ...issued, exerciseId: 'wrong' }, def)).toBe(false);
    expect(isIssuedAssessmentCompatible(undefined, def)).toBe(false);
  });
  it('echoes issued label and timestamp without accepting a different attempt', () => {
    const final = preserveIssuedAssignment(generated, issued);
    expect(final.assignment).toEqual(issued);
    expect(decodeResult(encodeResult(final)).assignment).toEqual(issued);
    expect(() => preserveIssuedAssignment({ ...generated,
      assignment: { ...generated.assignment, seed: 99 } }, issued)).toThrow();
    expect(() => preserveIssuedAssignment(generated, { ...issued, trade: 'cctv' })).toThrow();
  });
});
describe('bounded atomic evidence append', () => {
  it('never exceeds the result-code 400-event limit; last 400 survive submission', () => {
    let events: AttemptResult['evidence'] = [];
    const event = { action: 'wire', detail: 'Genuine learner action', accepted: true };
    for (let i = 0; i < MAX_EVIDENCE_EVENTS + 25; i++) {
      events = appendBoundedEvidence(events, event, i);
    }
    expect(events).toHaveLength(400);
    expect(events[0].index).toBe(26);
    expect(events[399].index).toBe(425);
    expect(decodeResult(encodeResult({ ...generated, evidence: events })).evidence).toEqual(events);
  });
  it('is pure under an updater replay and bounds field lengths', () => {
    const entry = { action: 'a'.repeat(100), detail: 'b'.repeat(1200), accepted: false };
    const x = appendBoundedEvidence([], entry, 2);
    expect(appendBoundedEvidence([], entry, 2)).toEqual(x);
    expect(x[0].action).toHaveLength(80);
    expect(x[0].detail).toHaveLength(1000);
    expect(appendBoundedEvidence(x, undefined, 3)).toBe(x);
  });
});
