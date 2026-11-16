import {circleHitsBox,segmentHitsBox} from './geometry.js';
export const CHARACTER_RADIUS=.3,CHARACTER_HEIGHT=2.25,STEP_HEIGHT=.26,SUPPORT_RADIUS=CHARACTER_RADIUS;

export function createCollisionWorld({WORLD_COLLIDERS=[],heightAt,withinZone,extraColliders=()=>[]}) {
// Static spatial buckets keep shared collision cheap at 60 movement steps/sec.
const CELL=8,cells=new Map();
for(const c of WORLD_COLLIDERS)for(let x=Math.floor(c.minX/CELL);x<=Math.floor(c.maxX/CELL);x++)for(let z=Math.floor(c.minZ/CELL);z<=Math.floor(c.maxZ/CELL);z++){const key=`${x}:${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(c);}
function nearbyColliders(x,z,radius=CHARACTER_RADIUS){const found=new Set();for(let cx=Math.floor((x-radius)/CELL);cx<=Math.floor((x+radius)/CELL);cx++)for(let cz=Math.floor((z-radius)/CELL);cz<=Math.floor((z+radius)/CELL);cz++)for(const c of cells.get(`${cx}:${cz}`)||[])found.add(c);return [...found,...extraColliders(x,z,radius)];}
function overlaps(x,z,c,radius=CHARACTER_RADIUS){return c.r!==undefined?Math.hypot(x-c.x,z-c.z)<c.r+radius:radius?circleHitsBox(x,z,c,radius):x>=c.minX&&x<=c.maxX&&z>=c.minZ&&z<=c.maxZ;}
function colliderTop(c,x,z){return c.topStart===undefined?c.maxY:c.topStart+(c.topEnd-c.topStart)*Math.max(0,Math.min(1,(z-c.minZ)/(c.maxZ-c.minZ)));}
function supportBelow(x,z,ceiling=Infinity,radius=SUPPORT_RADIUS){
  let y=heightAt(x,z),id='terrain';
  for(const c of nearbyColliders(x,z,radius)){const top=colliderTop(c,x,z);if(c.standable&&top<=ceiling+1e-6&&top>y&&overlaps(x,z,c,radius)){y=top;id=c.id;}}
  return {y,id};
}
function bodyFits(x,z,y,height=CHARACTER_HEIGHT){return withinZone(x,z)&&!nearbyColliders(x,z).some(c=>overlaps(x,z,c)&&y<colliderTop(c,x,z)-1e-6&&y+height>c.minY+1e-6);}
function groundWalkable(x,z){return bodyFits(x,z,heightAt(x,z));}
// Used for save/load and explicit teleports: settle onto the surface below the
// saved feet, never reset a character who logged out on top of furniture.
function settleOnSurface(pose){
  const floor=heightAt(pose.x,pose.z),support=supportBelow(pose.x,pose.z,Number.isFinite(pose.y)?Math.max(floor,pose.y):floor);
  pose.y=support.y;pose.supportId=support.id;pose.grounded=true;pose.jumpHeight=0;pose.jumpVelocity=0;
  return bodyFits(pose.x,pose.z,pose.y);
}

function lineOfSight(a,b,ignoreId=null){
 const from={x:a.x,z:a.z,y:Math.max(heightAt(a.x,a.z),a.y??-Infinity)+1.25},to={x:b.x,z:b.z,y:Math.max(heightAt(b.x,b.z),b.y??-Infinity)+1.25};
 const length=Math.hypot(b.x-a.x,b.z-a.z),seen=new Set(),steps=Math.max(1,Math.ceil(length/2));
 for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;for(const c of nearbyColliders(x,z,1))seen.add(c);}
 return ![...seen].some(c=>c.id!==ignoreId&&segmentHitsBox(from,to,c));
}

return {nearbyColliders,overlaps,colliderTop,supportBelow,bodyFits,groundWalkable,settleOnSurface,lineOfSight};
}
