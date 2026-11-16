import {EMOTE_NOTICE_RANGE} from '../shared/social.js';
import {ENEMY_TYPES} from '../shared/content.js';
import {lineOfSight} from '../shared/props.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=id=>[...id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);

// One perception pass/second; all timers use simulation time. Ambient gestures
// never call reward-bearing player encounter handlers or recursively react.
export class AmbientSocial{
 constructor(social){this.social=social;this.world=social.world;this.nextScan=2;this.globalReady=0;this.encounters=new Map();this.pairs=new Map();this.turn=0;}
 idle(unit){const w=this.world;return unit.hp>0&&!unit.target&&!unit.evading&&!unit.slamAt&&!unit.casting&&(!unit.emote||unit.emote.endsAt<=w.time);}
 canSee(a,b,r=EMOTE_NOTICE_RANGE){return b.hp>0&&distance(a,b)<=r&&lineOfSight(a,b);}
 available(unit){return this.idle(unit)&&!unit.roam&&unit.routineState!=='walking'&&(unit.nextAmbient||0)<=this.world.time&&(unit.socialBusyUntil||0)<=this.world.time;}
 emit(unit,id,target,cause){const w=this.world;if(w.time<this.globalReady||!this.available(unit))return false;
  unit.nextAmbient=w.time+24+hash(unit.id)%13;unit.socialBusyUntil=w.time+4;
  if(target){unit.facing=Math.atan2(target.x-unit.x,target.z-unit.z);if(unit.role)unit.faceUntil=w.time+5;}
  this.social.play(unit,id,target,undefined,{ambient:true,cause});this.globalReady=w.time+3;return true;
 }
 key(unit,target){return `${unit.id}:${target.id}`;}
 playerReady(p){return p.hp>0&&!p.auto&&!p.casting&&this.world.time-p.lastCombat>7;}
 freshEncounter(unit,p){const key=this.key(unit,p),last=this.encounters.get(key);if(last&&last.inside)return false;if(last&&this.world.time-last.at<90)return false;return true;}
 encounter(unit,p){this.encounters.set(this.key(unit,p),{inside:true,at:this.world.time});}
 observeEffect(kind,sourceId,targetId,amount){
  const w=this.world;if(!['level','heal'].includes(kind)||kind==='heal'&&!(amount>0)||w.time<this.globalReady)return;
  const source=w.players.get(sourceId);if(!source||!this.playerReady(source))return;const target=w.unit(targetId);if(!target)return;
  const witnesses=w.npcs.filter(n=>this.available(n)&&this.canSee(n,source)&&this.canSee(n,target));
  const npc=kind==='heal'&&target.role&&witnesses.includes(target)?target:witnesses.sort((a,b)=>distance(a,source)-distance(b,source))[0];
  if(npc)this.emit(npc,kind==='level'?'cheer':npc===target?'thank':'applaud',source,kind==='level'?'level':'healing');
 }
 victory(p,enemy){if(p.hp<=0)return;const npc=this.world.npcs.find(n=>this.available(n)&&this.canSee(n,p)&&distance(n,enemy)<=EMOTE_NOTICE_RANGE&&lineOfSight(n,enemy));if(npc)this.emit(npc,'cheer',p,'victory');}
 step(){const w=this.world;if(w.time<this.nextScan)return;this.nextScan=w.time+1;
  for(const [key,record]of this.encounters){const split=key.lastIndexOf(':'),unit=w.unit(key.slice(0,split)),p=w.players.get(key.slice(split+1));if(!unit||!p){this.encounters.delete(key);continue;}if(distance(unit,p)>16)record.inside=false;}
  if(w.time<this.globalReady)return;
  const players=[...w.players.values()].filter(p=>this.playerReady(p));if(!players.length)return;
  const npcs=w.npcs,units=[...npcs,...w.enemies];
  // Rotate scan priority, so a busy hearth cannot starve every outpost.
  const offset=this.turn++%units.length;
  for(let i=0;i<units.length;i++){
   const unit=units[(i+offset)%units.length];if(!this.available(unit))continue;
   const nearby=players.filter(p=>this.canSee(unit,p)).sort((a,b)=>distance(unit,a)-distance(unit,b));if(!nearby.length)continue;
   const visitor=nearby.find(p=>this.freshEncounter(unit,p));
   if(visitor){const friendly=unit.role||this.social.friendly(visitor,unit)||!ENEMY_TYPES[unit.type].aggro;
    // Hostile creatures warn from beyond their aggro radius. This does not
    // change combat, cancel a cast, grant peace, or select a target.
    const id=unit.role?(unit.services?.includes('trainer')?'nod':'wave'):friendly?'sniff':'growl';
    if(this.emit(unit,id,visitor,'proximity')){this.encounter(unit,visitor);return;}
   }
   if(!unit.role)continue;
   const companion=npcs.find(n=>n!==unit&&this.available(n)&&this.canSee(unit,n,12)&&w.time-(this.pairs.get([unit.id,n.id].sort().join(':'))??-100)>60);
   const pairKey=companion&&[unit.id,companion.id].sort().join(':');
   if(companion&&this.emit(unit,['nod','laugh','shrug'][hash(unit.id)%3],companion,'conversation')){this.pairs.set(pairKey,w.time);this.social.queueResponse(companion,unit,'nod',undefined,{ambient:true,cause:'conversation'});return;}
   if((unit.nextIdleSocial??(8+hash(unit.id)%20))<=w.time&&this.emit(unit,['yawn','shrug','sit'][hash(unit.id)%3],null,'idle')){
    // Sitting ambience lasts briefly, rather than hiding a service NPC for an hour.
    unit.emote.endsAt=Math.min(unit.emote.endsAt,w.time+6);const event=w.events.at(-1);if(event?.source===unit.id)event.endsAt=unit.emote.endsAt;unit.nextIdleSocial=w.time+50+hash(unit.id)%30;return;
   }
  }
 }
 forget(playerId){for(const key of this.encounters.keys())if(key.endsWith(`:${playerId}`))this.encounters.delete(key);}
}
