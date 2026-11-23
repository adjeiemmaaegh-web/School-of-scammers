/**
 * R20 machine guard cage: the wall rectangles of a `machine-guard` in world millimetres. A cage is a square of side `sizeMm` with
 * walls of `thicknessMm` on every side except the OPEN side (1 = +x, 2 = +y, 3 = -x, 4 = -y at yaw 0; the opening turns with the
 * placement yaw; 0 = closed on all four sides). Shared by material-flow physics and the walking operator so both see one cage.
 */
import type {EquipmentPlacement} from './types';

export type WallRect={cx:number;cy:number;w:number;d:number};
export function guardWalls(item:Pick<EquipmentPlacement,'originMm'|'yawDeg'|'params'>):WallRect[]{
 const size=item.params.sizeMm??1500,t=Math.min(item.params.thicknessMm??60,size/2);
 const open=item.params.openSide??1;
 const openIndex=open===0?-1:(((open-1+item.yawDeg/90)%4)+4)%4;      // 0:+x 1:+y 2:-x 3:-y
 const {x,y}=item.originMm,half=size/2-t/2;
 const walls:WallRect[]=[
  {cx:x+half,cy:y,w:t,d:size},{cx:x,cy:y+half,w:size,d:t},{cx:x-half,cy:y,w:t,d:size},{cx:x,cy:y-half,w:size,d:t},
 ];
 return walls.filter((_,i)=>i!==openIndex);
}
