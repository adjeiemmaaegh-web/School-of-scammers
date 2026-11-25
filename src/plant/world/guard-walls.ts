/**
 * R20 machine guard cage: the wall rectangles of a `machine-guard` in world millimetres. A cage is a square of side `sizeMm` with
 * walls of `thicknessMm` on every side except the OPEN side (1 = +x, 2 = +y, 3 = -x, 4 = -y at yaw 0; the opening turns with the
 * placement yaw; 0 = closed on all four sides). Shared by material-flow physics and the walking operator so both see one cage.
 */
import type {EquipmentPlacement} from './types';

export type WallRect={cx:number;cy:number;w:number;d:number;/** turn of the wall rectangle in degrees (the cage's free heading; 0 for a quarter-turn cage) */a?:number};
export function guardWalls(item:Pick<EquipmentPlacement,'originMm'|'yawDeg'|'params'|'headingDeg'>):WallRect[]{
 const size=item.params.sizeMm??1500,t=Math.min(item.params.thicknessMm??60,size/2);
 const open=item.params.openSide??1;
 const openIndex=open===0?-1:(((open-1+item.yawDeg/90)%4)+4)%4;      // 0:+x 1:+y 2:-x 3:-y
 const {x,y}=item.originMm,half=size/2-t/2;
 const walls:WallRect[]=[
  {cx:x+half,cy:y,w:t,d:size},{cx:x,cy:y+half,w:size,d:t},{cx:x-half,cy:y,w:t,d:size},{cx:x,cy:y-half,w:size,d:t},
 ];
 const kept=walls.filter((_,i)=>i!==openIndex);
 if(!item.headingDeg)return kept;
 // A free heading turns the whole cage about its centre: wall centres swing round it and every wall turns by the heading.
 const r=item.headingDeg*Math.PI/180,c=Math.cos(r),sn=Math.sin(r);
 return kept.map(w=>({cx:x+(w.cx-x)*c-(w.cy-y)*sn,cy:y+(w.cx-x)*sn+(w.cy-y)*c,w:w.w,d:w.d,a:item.headingDeg}));
}

/** True when the point lies inside the (possibly turned) wall rectangle. */
export function insideWall(wall:WallRect,x:number,y:number):boolean{
 const r=-(wall.a??0)*Math.PI/180,dx=x-wall.cx,dy=y-wall.cy;
 return Math.abs(dx*Math.cos(r)-dy*Math.sin(r))<=wall.w/2&&Math.abs(dx*Math.sin(r)+dy*Math.cos(r))<=wall.d/2;
}
/** Axis-aligned pieces covering a wall for the walking person: the wall itself when square to the axes, else short segments along its long side. */
export function wallPieces(wall:WallRect):{cx:number;cy:number;hx:number;hy:number}[]{
 if(!wall.a)return [{cx:wall.cx,cy:wall.cy,hx:wall.w/2,hy:wall.d/2}];
 const r=wall.a*Math.PI/180,c=Math.cos(r),sn=Math.sin(r),long=Math.max(wall.w,wall.d),thin=Math.min(wall.w,wall.d);
 const alongX=wall.w>=wall.d,n=Math.max(1,Math.ceil(long/Math.max(20,thin))),seg=long/n,out=[];
 for(let i=0;i<n;i++){
  const off=-long/2+seg*(i+.5),lx=alongX?off:0,ly=alongX?0:off;
  out.push({cx:wall.cx+lx*c-ly*sn,cy:wall.cy+lx*sn+ly*c,
   hx:(Math.abs(c)*(alongX?seg:thin)+Math.abs(sn)*(alongX?thin:seg))/2,hy:(Math.abs(sn)*(alongX?seg:thin)+Math.abs(c)*(alongX?thin:seg))/2});
 }
 return out;
}
