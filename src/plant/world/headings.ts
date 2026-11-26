/**
 * Kinds that accept a free heading (R21/R22): equipment whose carry direction, working frame or blocking rectangle is a plain
 * rectangle about its centre, so it can be turned by any angle. One list for the plant runner, the project bridge and the editor.
 * Machines with a workspace or solid envelope that assumes quarter turns (tanks, robots, palletizers, cranes) are not here.
 */
export const FREE_HEADING_KINDS: ReadonlySet<string> = new Set([
  'belt-conveyor', 'roller-conveyor', 'curved-conveyor', 'transfer-unit', 'turntable', 'index-table', 'process-station',
  'stopper', 'merge-gate', 'diverter-gate', 'safety-fence', 'guard-door', 'machine-guard', 'pusher', 'platform', 'stairs',
]);
