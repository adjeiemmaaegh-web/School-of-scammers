/** On-demand versions of heavy sandbox panels. Each is a drop-in for the original component (same props) that loads its code
 *  when first rendered, so the sandbox route's critical path stays under its budget (see scripts/check-performance-budgets.cjs). */
import { lazy, Suspense, type ComponentProps, type ComponentType } from 'react';

function onDemand<C extends ComponentType<any>>(load: () => Promise<C>): ComponentType<ComponentProps<C>> {
  const Lazy = lazy(async () => ({ default: await load() })) as unknown as ComponentType<ComponentProps<C>>;
  return function OnDemand(props: ComponentProps<C>) { return <Suspense fallback={null}><Lazy {...props} /></Suspense>; };
}

export const ProgrammingDock = onDemand(() => import('../program/ProgrammingDock').then(m => m.ProgrammingDock));
export const LiveMonitor = onDemand(() => import('../program/LiveMonitor').then(m => m.LiveMonitor));
export const TroubleshootingPanel = onDemand(() => import('../ui/sandbox/TroubleshootingPanel').then(m => m.TroubleshootingPanel));
export const PlantScenePanel = onDemand(() => import('../ui/sandbox/PlantScenePanel').then(m => m.PlantScenePanel));
export const FloorPlanCanvas = onDemand(() => import('../ui/sandbox/FloorPlanCanvas').then(m => m.FloorPlanCanvas));
