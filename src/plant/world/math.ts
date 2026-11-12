/** Quantised, axis-aligned teaching geometry; all mutations remain repeatable. */
import type {Body,Vec3} from './types';
export const q=(n:number):number=>{
 if(!Number.isFinite(n))throw new RangeError('Non-finite plant simulation value');
 return Math.round(n*1_000_000)/1_000_000;
};
export const clamp=(n:number,min:number,max:number):number=>q(Math.min(max,Math.max(min,n)));
export const vec=(x=0,y=0,z=0):Vec3=>({x:q(x),y:q(y),z:q(z)});
export const add=(a:Vec3,b:Vec3):Vec3=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
export const overlap1d=(a:number,da:number,b:number,db:number):number=>
 Math.min(a+da/2,b+db/2)-Math.max(a-da/2,b-db/2);
export const footprintOverlap=(a:Body,b:Body,margin=0):boolean=>
 overlap1d(a.pos.x,a.size.x,b.pos.x,b.size.x)>-margin &&
 overlap1d(a.pos.y,a.size.y,b.pos.y,b.size.y)>-margin;
export const insideFootprint=(p:Vec3,center:Vec3,size:Vec3):boolean=>
 Math.abs(p.x-center.x)<=size.x/2&&Math.abs(p.y-center.y)<=size.y/2;
export const face=(yaw:number):Vec3=>{
 if(![0,90,180,270].includes(yaw))throw new RangeError('Only 90 degree rotations are modelled');
 return yaw===0?vec(1,0,0):yaw===90?vec(0,1,0):yaw===180?vec(-1,0,0):vec(0,-1,0);
};
export const nearest=(a:Vec3,b:Vec3):number=>q(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z));
export const translate=(body:Body,by:Vec3):Body=>({...body,pos:add(body.pos,by)});
