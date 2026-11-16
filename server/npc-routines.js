import {CITY_ROUTINES} from '../shared/city-routines.js';
import {regionAt} from '../shared/zone-regions.js';
import {advanceMotion,MOVE_SPEED} from '../shared/movement.js';
import {settleOnSurface} from '../shared/props.js';
export class NPCRoutines{
 constructor(world){this.world=world;this.plans=new Map();for(const [id,r]of Object.entries(CITY_ROUTINES))this.plans.set(id,{...r,regions:new Set(r.stops.map(p=>regionAt(p.x,p.z))),period:r.stops.reduce((sum,p,i)=>{const prev=r.stops[(i+r.stops.length-1)%r.stops.length];return sum+Math.hypot(p.x-prev.x,p.z-prev.z)/r.speed+(p.wait||0);},0)});
  for(const n of world.npcs)if(n.routineId){settleOnSurface(n);n.routeIndex=0;n.routeWaitUntil=n.phaseDelay||0;n.routineState='waiting';}}
 fastForward(n,r,now){
  let at=Math.max(n.suspendedAt,n.faceUntil||0,n.emote?.endsAt||0);n.suspendedAt=null;
  // Authored paths have validated collision. Only unseen actors may advance
  // analytically; any circuit entering a subscribed region keeps simulating.
  while(at<now){
   if(n.routeWaitUntil>at){at=Math.min(now,n.routeWaitUntil);if(at>=now)break;}
   if(n.routeIndex===0&&now-at>r.period){at+=Math.floor((now-at)/r.period)*r.period;if(at>=now)break;}
   const point=r.stops[n.routeIndex],dx=point.x-n.x,dz=point.z-n.z,d=Math.hypot(dx,dz),duration=d/r.speed;
   if(duration>0)n.facing=Math.atan2(dx,dz);
   if(at+duration>now){const t=(now-at)/duration;n.x+=dx*t;n.z+=dz*t;at=now;}
   else{n.x=point.x;n.z=point.z;at+=duration;n.routeWaitUntil=at+(point.wait||0);n.routeIndex=(n.routeIndex+1)%r.stops.length;}
  }
  settleOnSurface(n);
 }
 step(dt,active=null){const w=this.world;for(const n of w.npcs){const r=this.plans.get(n.routineId);if(!r)continue;
   if(active&&![...r.regions].some(id=>active.has(id))){n.suspendedAt??=w.time-dt;continue;}
   if(n.suspendedAt!=null)this.fastForward(n,r,w.time-dt);
   if(n.hp<=0||n.faceUntil>w.time||n.emote?.endsAt>w.time){n.routineState='talking';continue;}
   if(n.routeWaitUntil>w.time){n.routineState='waiting';continue;}
   const point=r.stops[n.routeIndex],dx=point.x-n.x,dz=point.z-n.z,d=Math.hypot(dx,dz);
   if(d<.12){n.routeWaitUntil=w.time+(point.wait||0);n.routeIndex=(n.routeIndex+1)%r.stops.length;n.routineState=point.wait?'waiting':'walking';continue;}
   n.routineState='walking';const scale=Math.min(r.speed,d/Math.max(dt,.001))/MOVE_SPEED;
   advanceMotion(n,{x:dx/d*scale,z:dz/d*scale,facing:Math.atan2(dx,dz)},dt);
 }}
}
