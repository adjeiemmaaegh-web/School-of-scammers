/**
 * Platform-wide configuration.
 * Brand name is a single source of truth so renaming is a one-line change
 * (the final brand is still an open product decision — see docs/product/PRD.md §13).
 */
export const BRAND = {
  name: 'EFO Skill Lab',
  tagline: 'Build, wire, program and run a virtual factory.',
  shortPitch:
    'A browser-based virtual industrial automation laboratory: place equipment in 3D, wire it terminal by terminal, program one or more PLCs, run a deterministic scan engine against a live plant, then break it, measure it and fix it.',
} as const;
