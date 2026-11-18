/**
 * Hidden-fault redaction for anything a learner can download (roadmap R8.2/R8.5). A hidden fault's kind and target are
 * the answer to a troubleshooting exercise, so graded sessions must not write them into an exported project file.
 * This is a courtesy boundary in a frontend-only app: the data still lives in the page's memory and browser storage,
 * so it is not secrecy against someone inspecting the browser, and the docs say so.
 */
import type { ProjectFile } from './signals';

export function redactHiddenFaults(project: ProjectFile): ProjectFile {
  if (!project.faults?.some(f => f.hidden)) return project;
  const visible = project.faults.filter(f => !f.hidden);
  const { faults: _hidden, ...rest } = project;
  return visible.length ? { ...rest, faults: visible } : rest;
}
