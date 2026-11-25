/**
 * R3.2 — Read-only integration seam for the existing device registries.
 *
 * The visual/terminal registry, parameter definitions and physical equipment
 * registry remain their authoritative sources. This adapter joins their
 * contracts by ComponentKind; it DOES NOT create another competing catalog
 * or perform simulation. Worker semantics stay in the electrical and plant
 * models, and every runtime instance is identified by its component id.
 */
import { COMPONENTS, type ComponentKind, type Terminal } from '../components/registry';
import { paramSpecsOf, type ParamSpec } from '../components/params';
import { PLANT_EQUIPMENT } from '../plant/equipment';
import type { Channel } from '../plant/world/equipment';

export type DeviceIntegrationContract = {
  readonly kind: ComponentKind;
  readonly label: string;
  /** Canonical connection ports used by the electrical/numeric wire editors. */
  readonly terminals: readonly Terminal[];
  /** Existing validated and persisted per-device configuration definitions. */
  readonly parameters: readonly ParamSpec[];
  /** Plant model capabilities, absent for legacy control-panel components. */
  readonly plant: null | {
    readonly commands: readonly Channel[];
    readonly signals: readonly Channel[];
    readonly faults: readonly string[];
  };
};

/** An adapter, not a new registry: reading it never mutates a project or steps the plant. */
export function deviceIntegrationContract(kind: ComponentKind): DeviceIntegrationContract {
  const component = COMPONENTS[kind];
  const plant = PLANT_EQUIPMENT[kind];
  return {
    kind,
    label: component.label,
    terminals: component.terminals,
    parameters: paramSpecsOf(kind),
    plant: plant ? { commands: plant.commands, signals: plant.signals, faults: plant.faults } : null,
  };
}
