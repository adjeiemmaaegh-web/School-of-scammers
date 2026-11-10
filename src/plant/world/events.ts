/** Event limits are part of the save/replay and observable loss contract. */
import type {World,WorldEvent} from './types';
import {MAX_WORLD_EVENTS} from './types';
export function addEvent(world:World,event:Omit<WorldEvent,'atMs'>):World{
 const record:WorldEvent={...event,atMs:world.timeMs};
 if(world.events.length>=MAX_WORLD_EVENTS)
  return {...world,droppedEventCount:world.droppedEventCount+1};
 return {...world,events:[...world.events,record]};
}
export const drainEvents=(world:World):{world:World;events:WorldEvent[]}=>({
 world:{...world,events:[]},events:world.events.map(event=>({...event})),
});
