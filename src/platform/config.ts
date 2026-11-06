/**
 * Platform-wide configuration.
 * Brand name is a single source of truth so renaming is a one-line change
 * (the final brand is still an open product decision — see docs/product/PRD.md §13).
 */
export const BRAND = {
  name: 'EFO Skill Lab',
  tagline: 'Practice the trade. Prove you can do the job.',
  shortPitch:
    'A browser-based simulator where learners build real hands-on skills and employers test candidates on realistic, job-like tasks. Starting with PLC & industrial automation.',
} as const;
