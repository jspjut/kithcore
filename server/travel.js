import {sampleFlight} from '../shared/flight-motion.js';
import {TRAVEL_NODES,travelNode,flightRoute,nearbyTravelNodes} from '../shared/travel-network.js';
import {heightAt} from '../shared/terrain.js';
import {zoneAt} from '../shared/zone-layout.js';
import {waypointFor,WAYPOINTS,RECALL_COOLDOWN} from '../shared/travel.js';
import {lineOfSight,settleOnSurface} from '../shared/props.js';
export class TravelSystem{
 constructor(world){this.world=world;}
 initialize(p,saved){p.gameMaster=saved?.gameMaster===true;p.travelUnlocks=[...new Set((Array.isArray(saved?.travelUnlocks)?saved.travelUnlocks:[]).filter(id=>travelNode(id)))];if(p.gameMaster)p.travelUnlocks=TRAVEL_NODES.map(n=>n.id);p.transit=null;p.waypointId=waypointFor(saved?.waypointId).id;const remaining=Number.isFinite(saved?.recallReadyAt)?Math.max(0,Math.min(RECALL_COOLDOWN,(saved.recallReadyAt-Date.now())/1000)):0;if(remaining>0)p.cooldowns.recall=this.world.time+remaining;}
 save(p){const departure=p.transit&&travelNode(p.transit.from);return {...(p.gameMaster?{gameMaster:true}:{}),...(departure?{x:departure.x,z:departure.z,y:heightAt(departure.x,departure.z),mapId:departure.mapId}:{}),travelUnlocks:[...(p.travelUnlocks||[])],waypointId:p.waypointId,recallReadyAt:(p.cooldowns.recall||0)>this.world.time?Date.now()+((p.cooldowns.recall||0)-this.world.time)*1000:0};}
 canReturn(p){if(p.transit){this.world.notify(p,'Finish your journey first.');return false;}if(p.auto&&this.world.enemy(p.target)?.hp>0||this.world.time-p.lastCombat<7){this.world.notify(p,'Leave combat before returning to your waypoint.');return false;}return true;}
 bind(p,msg){const w=this.world,point=WAYPOINTS.find(v=>v.available&&(msg.waypointId?v.selfService===true&&v.id===msg.waypointId:typeof msg.npcId==='string'&&v.npcId===msg.npcId)),host=point&&(point.selfService?point:w.npcs.find(n=>n.id===point.npcId&&n.services?.includes('waypoint')));
  if(!host||p.hp<=0||!p.grounded||p.storageBusy||Math.hypot(p.x-host.x,p.z-host.z)>4.8||!lineOfSight(p,host))return w.notify(p,'Visit the innkeeper or inn hearth to set your return waypoint.');
  if(p.casting||!this.canReturn(p))return;p.waypointId=point.id;w.notify(p,`Return waypoint set: ${point.name}. Hearthward Return has a 15-minute cooldown.`,'good');
 }

 complete(p){const w=this.world;if(!this.canReturn(p))return false;const point=waypointFor(p.waypointId),arrival={x:point.x,z:point.z};if(!settleOnSurface(arrival))return w.notify(p,'That waypoint is temporarily obstructed. Your return has not been spent.');
  Object.assign(p,arrival);p.mapId=zoneAt(p.x,p.z);p.waypointId=point.id;p.auto=false;p.input={x:0,z:0};p.target=null;p.bankNpcId=null;p.emote=null;w.resetMotion(p);p.cooldowns.recall=w.time+RECALL_COOLDOWN;w.effect('recall',p.id,p.id,0);w.notify(p,`Returned to ${point.name}.`,'good');return true;
 }
 discover(p){if(p.transit||p.hp<=0||!p.grounded)return;for(const node of nearbyTravelNodes(p.x,p.z))if(!p.travelUnlocks.includes(node.id)&&Math.hypot(p.x-node.x,p.z-node.z)<12&&lineOfSight(p,node)){p.travelUnlocks.push(node.id);this.world.notify(p,`Travel route discovered: ${node.name}.`,'good');}}
 depart(p,msg){
  const w=this.world,from=travelNode(msg.from),to=travelNode(msg.to),mode=msg.mode;
  if(!from||!to||from===to||!['flight','portal'].includes(mode)||p.hp<=0||p.casting||!p.grounded||p.storageBusy||!this.canReturn(p))return;
  if(!p.travelUnlocks.includes(from.id)||!p.travelUnlocks.includes(to.id)||Math.hypot(p.x-from.x,p.z-from.z)>14||!lineOfSight(p,from))return w.notify(p,'Visit both travel stones on foot before using this route.');
  if(mode==='portal'){
   if(from.kind!=='capital'||to.kind!=='capital')return;
   const arrival={x:to.x,z:to.z};if(!settleOnSurface(arrival))return w.notify(p,'The arrival stone is obstructed.');
   this.closeInteractions(p);Object.assign(p,arrival);p.mapId=zoneAt(p.x,p.z);w.resetMotion(p);return w.notify(p,`Arrived in ${to.name}.`,'good');
  }
  const points=flightRoute(from.id,to.id,p.travelUnlocks);if(!points||points.length<2)return w.notify(p,'Discover a connected chain of flight stones first.');
  let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  this.closeInteractions(p);p.transit={from:from.id,to:to.id,points,length,progress:0,elapsed:0,duration:Math.max(8,length/90)};w.resetMotion(p);w.notify(p,`Flying to ${to.name}.`,'good');
 }
 explore(p,msg){if(p.gameMaster!==true||p.storageBusy)return;const node=travelNode(msg.to);if(!node)return;const arrival={x:node.x,z:node.z};if(!settleOnSurface(arrival))return this.world.notify(p,'That destination is obstructed.');this.world.cancelCast(p);this.closeInteractions(p);p.transit=null;Object.assign(p,arrival);p.mapId=zoneAt(p.x,p.z);this.world.resetMotion(p);this.world.notify(p,`Exploring ${node.name}.`,'good');}

 closeInteractions(p){p.auto=false;p.input={x:0,z:0};p.target=null;p.bankNpcId=null;p.mailboxId=null;p.emote=null;}
 advance(p,dt){const trip=p.transit;if(!trip)return false;
  if(p.hp<=0){p.transit=null;settleOnSurface(p);this.world.resetMotion(p);return false;}
  trip.elapsed=Math.min(trip.duration,trip.elapsed+dt);trip.progress=trip.elapsed/trip.duration;
  Object.assign(p,sampleFlight(trip,trip.elapsed,heightAt));p.mapId=zoneAt(p.x,p.z);
  if(trip.progress>=1){const to=travelNode(trip.to);Object.assign(p,{x:to.x,z:to.z});delete p.y;settleOnSurface(p);p.transit=null;this.world.resetMotion(p);this.world.notify(p,`Arrived at ${to.name}.`,'good');}
  return true;
 }
 view(p){return p.transit?{from:p.transit.from,to:p.transit.to,points:p.transit.points,length:p.transit.length,duration:p.transit.duration,elapsed:p.transit.elapsed,progress:p.transit.progress,remaining:Math.max(0,p.transit.duration-p.transit.elapsed)}:null;}

}
