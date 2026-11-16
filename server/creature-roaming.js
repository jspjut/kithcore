import {walkable,NPCS,ZONE} from '../shared/content.js';
const hash=value=>[...value].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);
export const ROAM_STRIDE=2.3;
// Choose a fixed destination and finish one to three complete gait strides.
// A blocked path is rejected before walking starts; no drifting chase target.
export function roamCreature(world,unit,definition,dt){
 // Boss arenas are authored around their home anchor, not ambient patrols.
 if(definition.boss)return;
 const now=world.time;
 if(unit.emote?.endsAt>now||unit.socialBusyUntil>now){unit.roam=null;unit.nextRoamAt=now+2;return;}
 if(!unit.roam){
  unit.nextRoamAt??=now+1+hash(unit.id)%40/10;
  if(now<unit.nextRoamAt)return;
  const seed=hash(`${unit.id}:${unit.roamSequence||0}`);unit.roamSequence=(unit.roamSequence||0)+1;
  const cycles=1+seed%3,distance=cycles*ROAM_STRIDE;
  // Preserve the starter's existing safe service/spawn approaches. A longer
  // stroll must not expand an aggressive pack into an NPC's interaction space.
  const protectedPoints=definition.aggro?[ZONE.spawn,...(world.npcs||NPCS)].map(p=>({...p,clearance:Math.max(0,Math.min(definition.aggro+3,Math.hypot(p.x-unit.homeX,p.z-unit.homeZ)-1.5))})).filter(p=>Math.hypot(p.x-unit.x,p.z-unit.z)<20):[];
  for(let attempt=0;attempt<12;attempt++){
   const angle=(seed%6283)/1000+attempt*Math.PI/6,x=unit.x+Math.sin(angle)*distance,z=unit.z+Math.cos(angle)*distance;
   if(Math.hypot(x-unit.homeX,z-unit.homeZ)>9)continue;
   let clear=true;const samples=Math.ceil(distance/.35);
   for(let i=1;i<=samples;i++){const px=unit.x+(x-unit.x)*i/samples,pz=unit.z+(z-unit.z)*i/samples;if(!walkable(px,pz)||protectedPoints.some(p=>Math.hypot(px-p.x,pz-p.z)<p.clearance)){clear=false;break;}}
   if(clear){unit.roam={x,z,cycles};unit.facing=angle;break;}
  }
  if(!unit.roam){unit.nextRoamAt=now+3;return;}
 }
 const goal=unit.roam,dx=goal.x-unit.x,dz=goal.z-unit.z,distance=Math.hypot(dx,dz),step=Math.min(distance,Math.min(definition.speed,1.6)*dt),oldX=unit.x,oldZ=unit.z;
 if(distance>1e-6)world.move(unit,dx/distance*step,dz/distance*step);
 if(distance<=step+1e-6||Math.hypot(unit.x-oldX,unit.z-oldZ)<step*.5){unit.roam=null;unit.nextRoamAt=now+2+hash(`${unit.id}:${unit.roamSequence}`)%40/10;}
}
