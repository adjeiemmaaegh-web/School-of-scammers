/**
 * Hidden-fault redaction for anything a learner can download (roadmap R8.2/R8.5). A hidden fault's kind and target are
 * the answer to a troubleshooting exercise, so graded sessions must not write them into an exported project file.
 * Plant equipment faults (`plantFaults`, e.g. a jammed stopper or a dead sensor) have no visible/hidden flag: in a graded
 * session they are always seeded by the exercise, so the graded export drops them all (finding F-12).
 * This is a courtesy boundary in a frontend-only app: the data still lives in the page's memory and browser storage,
 * so it is not secrecy against someone inspecting the browser, and the docs say so.
 */
import type { ProjectFile } from './signals';

export function redactHiddenFaults(project: ProjectFile): ProjectFile {
  const hiddenElectrical = !!project.faults?.some(f => f.hidden);
  const plant = !!project.plantFaults && Object.keys(project.plantFaults).length > 0;
  if (!hiddenElectrical && !plant) return project;
  const { faults, plantFaults: _plant, ...rest } = project;
  const visible = (faults ?? []).filter(f => !f.hidden);
  return visible.length ? { ...rest, faults: visible } : rest;
}
