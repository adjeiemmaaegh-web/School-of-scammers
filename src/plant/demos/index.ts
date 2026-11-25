/** The seven integrated demonstration projects (see docs/product/UNIVERSITY_DEMONSTRATIONS.md). Each is a normal editable project. */
import {sortingFactoryDemo} from './sorting-factory';
import {machiningAssemblyDemo} from './machining-assembly';
import {pneumaticCellDemo} from './pneumatic-cell';
import {multiPlcFactoryDemo} from './multi-plc-factory';
import {processControlDemo} from './process-control';
import {humanInteractionDemo} from './human-interaction';
import {rejectReworkDemo} from './reject-rework';
import type {ProjectFile} from '../../sim/signals';

export type DemoEntry={id:string;letter:'A'|'B'|'C'|'D'|'E'|'F'|'G';title:string;summary:string;build:()=>ProjectFile};
export const DEMOS:readonly DemoEntry[]=[
 {id:'sorting-factory',letter:'A',title:'Automated sorting factory',build:sortingFactoryDemo,
  summary:'Mixed metal workpieces and cartons on one belt; an inductive sensor and a powered transfer unit divert metal into a reject bin, cartons reach the good bin.'},
 {id:'machining-assembly',letter:'B',title:'Machining and assembly cell',build:machiningAssemblyDemo,
  summary:'A raw part is indexed into a machining station, machined, joined with a lid at an assembly station and collected; state and trace follow the part.'},
 {id:'pneumatic-cell',letter:'C',title:'Pneumatic production cell',build:()=>pneumaticCellDemo(),
  summary:'Compressor, receiver, regulator and cylinder cycled by a PLC through solenoids and limit switches; pressure, leak, restrictor and load faults change the cycle.'},
 {id:'multi-plc-factory',letter:'D',title:'Multi-PLC manufacturing factory',build:multiPlcFactoryDemo,
  summary:'Two PLCs run two cells joined by a belt and a 24V handshake wire; a stalled downstream cell backs the upstream one up.'},
 {id:'process-control',letter:'E',title:'Industrial process control',build:processControlDemo,
  summary:'Level hysteresis, heater thermostat and agitator from analog inputs, operator drain button and an indicator panel with alarms.'},
 {id:'human-interaction',letter:'F',title:'Human interaction and troubleshooting',build:humanInteractionDemo,
  summary:'A fenced cell with an interlocked door and restricted zone: a simulated operator walks in, the PLC stops the line, and double faults show the hazard.'},
 {id:'reject-rework',letter:'G',title:'Reject and rework line',build:()=>rejectReworkDemo(),
  summary:'Machining makes some defective parts; an inspect station and the PLC divert failures sideways to a rework station that repairs them, good parts go straight on.'},
];
