/**
 * Curved conveyor geometry (R03/R15): a 90-degree arc of constant radius. In the item's own frame the belt enters heading +x at
 * its start point S, then turns left (turnRight=0) or right (turnRight=1) around centre C = S +/- (0, R). The item origin is the
 * middle of the arc's bounding box, so the part can be placed and rotated like any other conveyor. A body is carried when it
 * lies in the quarter-annulus of the belt, and its carry direction is the tangent there.
 */
import type {EquipmentPlacement,Vec3} from './types';

export type Arc={cx:number;cy:number;radius:number;halfWidth:number;sign:1|-1;yawRad:number};
export const arcRadius=(item:EquipmentPlacement):number=>item.params.radiusMm??600;
export const arcWidth=(item:EquipmentPlacement):number=>item.params.widthMm??300;

/** Arc description in world coordinates. */
export function arcOf(item:EquipmentPlacement):Arc{
 const R=arcRadius(item),w=arcWidth(item),right=item.params.turnRight===1;
 const sign:1|-1=right?-1:1;                                     // +1 turns toward +y (left), -1 toward -y (right)
 // Local bounding box: x in [sx, sx+R+w/2]; y spans [sy-w/2, sy+R] (left) or [sy-R, sy+w/2] (right).
 const sx=-(R+w/2)/2,sy=-sign*(R-w/2)/2;
 const lcx=sx,lcy=sy+sign*R;                                       // centre of the turn, local
 // The belt's angle is its quarter-turn yaw plus any free heading (R21/R22): the arc itself is already true geometry.
 const yaw=(item.yawDeg+(item.headingDeg??0))*Math.PI/180,c=Math.round(Math.cos(yaw)*1e9)/1e9,s=Math.round(Math.sin(yaw)*1e9)/1e9;
 return {cx:item.originMm.x+c*lcx-s*lcy,cy:item.originMm.y+s*lcx+c*lcy,radius:R,halfWidth:w/2,sign,yawRad:yaw};
}
/** True when the point lies on the belt surface (inside the annulus and inside the quarter that the bounding box selects). */
export function arcContains(item:EquipmentPlacement,pos:Vec3):boolean{
 const a=arcOf(item);
 const dx=pos.x-a.cx,dy=pos.y-a.cy,r=Math.hypot(dx,dy);
 if(r<a.radius-a.halfWidth||r>a.radius+a.halfWidth)return false;
 // Local coordinates of the point relative to C: the quarter runs from angle -sign*90deg (the entry) to 0 (the exit).
 const c=Math.cos(-a.yawRad),s=Math.sin(-a.yawRad);
 const lx=c*dx-s*dy,ly=s*dx+c*dy;
 return lx>=-1e-6&&a.sign*ly<=1e-6;
}
/** Unit carry direction at the point: the tangent of the arc (counter-clockwise for a left turn, clockwise for a right turn). */
export function arcTangent(item:EquipmentPlacement,pos:Vec3):{x:number;y:number}{
 const a=arcOf(item);
 const dx=pos.x-a.cx,dy=pos.y-a.cy,r=Math.hypot(dx,dy)||1;
 return {x:-a.sign*dy/r,y:a.sign*dx/r};
}
/** Where a body leaves the belt: the end of the arc, and the heading it has there (for connecting the next conveyor). */
export function arcExit(item:EquipmentPlacement):{x:number;y:number;headingDeg:number}{
 const a=arcOf(item);
 const c=Math.cos(a.yawRad),s=Math.sin(a.yawRad);
 // local exit point: on the +x side of C at radius R (angle 0 relative to C); heading is +/-y in local frame
 const lx=a.radius,ly=0;
 return {x:a.cx+c*lx-s*ly,y:a.cy+s*lx+c*ly,headingDeg:(item.yawDeg+(item.headingDeg??0)+a.sign*90+360)%360};
}
