import {heightAt} from './terrain.js';
import {CHARACTER_HEIGHT,STEP_HEIGHT,bodyFits,nearbyColliders,overlaps,supportBelow} from './props.js';

export const MOVE_STEP=1/60,MOVE_SPEED=6.5,MAX_MOVE_QUEUE=120,MOVE_BUDGET=.1;
export const BACKPEDAL_MULTIPLIER=.5;
export const JUMP_SPEED=7.5,GRAVITY=20;
// Legacy directional input turns into travel. Explicit facing lets modern
// controls strafe/backpedal; apply the same speed rule in authority and replay.
export function movementSpeed(input){
  const backward=Number.isFinite(input.facing)&&input.x*Math.sin(input.facing)+input.z*Math.cos(input.facing)<-1e-6;
  return MOVE_SPEED*(backward?BACKPEDAL_MULTIPLIER:1);
}
export function normalizeInput(input){
  if(!Number.isFinite(input?.x)||!Number.isFinite(input?.z))return null;
  if(input.facing!==undefined&&!Number.isFinite(input.facing))return null;
  const length=Math.max(1,Math.hypot(input.x,input.z));return {x:input.x/length,z:input.z/length,jump:input.jump===true,...(input.facing===undefined?{}:{facing:Math.atan2(Math.sin(input.facing),Math.cos(input.facing))})};
}
function step(p,input,dt){
  if(!Number.isFinite(p.y)){p.y=heightAt(p.x,p.z)+(p.jumpHeight||0);p.grounded=!p.jumpHeight&&!p.jumpVelocity;}
  let support=supportBelow(p.x,p.z,p.y+.015);
  if(p.grounded&&Math.abs(p.y-support.y)<.04)p.y=support.y;
  else if(p.grounded){if(support.y>p.y&&support.id==='terrain')p.y=support.y;else p.grounded=false;}
  if(input.jump&&p.grounded&&!p.jumpVelocity){p.jumpVelocity=JUMP_SPEED;p.grounded=false;}
  const previousY=p.y;
  if(!p.grounded||p.jumpVelocity){
    let nextY=p.y+(p.jumpVelocity||0)*dt-GRAVITY/2*dt*dt;p.jumpVelocity=(p.jumpVelocity||0)-GRAVITY*dt;
    if(nextY>p.y)for(const c of nearbyColliders(p.x,p.z))if(overlaps(p.x,p.z,c)&&p.y+CHARACTER_HEIGHT<=c.minY+1e-6&&nextY+CHARACTER_HEIGHT>c.minY){nextY=Math.min(nextY,c.minY-CHARACTER_HEIGHT);p.jumpVelocity=0;}
    p.y=nextY;
  }
  const grounded=p.grounded,speed=movementSpeed(input);
  for(const [axis,delta]of [['x',input.x*speed*dt],['z',input.z*speed*dt]]){
    if(!delta)continue;const x=p.x+(axis==='x'?delta:0),z=p.z+(axis==='z'?delta:0);let y=p.y;
    const nextSupport=supportBelow(x,z,Math.max(p.y,heightAt(x,z))+(grounded?STEP_HEIGHT:0));
    if(grounded&&nextSupport.y>y&&nextSupport.y-y<=STEP_HEIGHT+1e-6)y=nextSupport.y;
    if(grounded&&nextSupport.id==='terrain'&&nextSupport.y>y)y=nextSupport.y;
    if(bodyFits(x,z,y)){p.x=x;p.z=z;p.y=y;}
  }
  support=supportBelow(p.x,p.z,Math.max(previousY,p.y)+.015);
  if(p.jumpVelocity<=0&&p.y<=support.y+.000001){p.y=support.y;p.jumpVelocity=0;p.grounded=true;}
  else if(grounded&&Math.abs(p.y-support.y)<=STEP_HEIGHT){p.y=support.y;p.grounded=true;}
  else p.grounded=false;
  p.supportId=p.grounded?support.id:null;p.jumpHeight=p.grounded?0:Math.max(0,p.y-supportBelow(p.x,p.z,p.y).y);
  if(Number.isFinite(input.facing))p.facing=input.facing;
  else if(input.x||input.z)p.facing=Math.atan2(input.x,input.z);
}
// Shared authority and prediction. Bounded substeps also protect legacy input
// and background settling from tunneling through thin rails or table edges.
export function advanceMotion(pose,input,dt=MOVE_STEP){
  let remaining=Math.max(0,Math.min(.1,dt)),first=true;
  while(remaining>1e-9){const delta=Math.min(MOVE_STEP,remaining);step(pose,{...input,jump:first&&input.jump},delta);remaining-=delta;first=false;}
  return pose;
}
export function motionPose(p){return {x:p.x,z:p.z,y:Number.isFinite(p.y)?p.y:heightAt(p.x,p.z)+(p.jumpHeight||0),facing:p.facing||0,grounded:p.grounded??(!p.jumpHeight&&!p.jumpVelocity),supportId:p.supportId||null,jumpHeight:p.jumpHeight||0,jumpVelocity:p.jumpVelocity||0};}
