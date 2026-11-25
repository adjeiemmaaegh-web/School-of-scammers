/**
 * Kinds that accept a free heading (R21/R22): equipment whose carry direction, working frame or blocking rectangle is a plain
 * rectangle about its centre, so it can be turned by any angle. One list for the plant runner, the project bridge and the editor.
 * Round or solid-envelope machines (tanks, robots, palletizers, cranes, pushers, platforms, stairs) are not here.
 */
export const FREE_HEADING_KINDS: ReadonlySet<string> = new Set([
  'belt-conveyor', 'roller-conveyor', 'curved-conveyor', 'transfer-unit', 'turntable', 'index-table', 'process-station',
  'stopper', 'merge-gate', 'diverter-gate', 'safety-fence', 'guard-door', 'machine-guard',
]);
