/** Plain-language limits of each device family, shown in the inspector (roadmap R7.6). Educational simplifications, stated up front. */
const GENERIC = 'Educational model: simplified, not calibrated, certified or safety-rated.';
const BY_KIND: Readonly<Record<string, string>> = {
  supply: 'Ideal 24 V DC source with no current limit or ripple; a different supply is a different reference.',
  plc: 'Fixed 5-input / 6-output teaching controller on a 50 ms scan; not a vendor firmware model.',
  plc16: 'Configurable 16/16 teaching controller on a 50 ms scan; not a vendor firmware model.',
  contactor: 'Coil and contacts with a one-scan delay; no arcing, bounce, ratings or coil inrush.',
  relay: 'Coil and contacts with a one-scan delay; contact ratings are not modelled.',
  timerelay: 'On-delay only, with a delay resolution of one 50 ms scan; no off-delay or pulse modes.',
  motor: 'Idealised 24 V load: on or off, no torque, speed, thermal or current model.',
  breaker: 'Trips on a modelled short or manually; not a rated protective device.',
  overload: 'Manual test trip of an auxiliary contact; no thermal model.',
  estop: 'Training pushbutton with a latch; not a safety-rated E-stop circuit.',
  cylinder: 'Fixed travel times (about 1.2 s out, 1.0 s back); air is assumed available, no pressure, force or cushioning model.',
  tank: 'Simple volume model with fixed fill and drain rates; no fluid dynamics.',
  'three-phase-supply': 'Teaching abstraction of a three-phase source; not mains design, protection or sizing.',
  'star-delta-drive': 'Sequencing and interlock teaching model; no motor current or torque calculation.',
};
const BY_PREFIX: readonly [string, string][] = [
  ['belt', 'Kinematic belt with friction slip and queueing; no belt tension, wear or load dynamics.'],
  ['roller', 'Simplified roller transport; no roller-level mechanics.'],
  ['robot', 'Kinematic arm with a workspace limit and simple collision stop; no dynamics, payload or vendor kinematics.'],
  ['asrs', 'Bay-based storage crane with fixed travel times; no load or sway modelling.'],
  ['photoeye', 'Beam against simulated geometry; no optics, ambient light or lens effects beyond the listed settings.'],
  ['capacitive', 'Range-and-delay detector against simulated bodies; not a calibrated sensing field.'],
  ['inductive', 'Short-range metal detector against simulated bodies; not a calibrated sensing field.'],
];
export function modelLimitFor(kind: string): string {
  const exact = BY_KIND[kind];
  if (exact) return `${exact} ${GENERIC}`;
  const prefix = BY_PREFIX.find(([p]) => kind.startsWith(p) || kind.includes(p));
  return prefix ? `${prefix[1]} ${GENERIC}` : GENERIC;
}
