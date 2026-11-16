import {AmbientSocial} from './ambient-social.js';
import {EMOTES,knowsEmote,emoteText,normalizeSocial,npcFaction,EMOTE_TARGET_RANGE,EMOTE_NOTICE_RANGE,FACTIONS,PEACE_FACTION} from '../shared/social.js';
import {ENEMY_TYPES,activeQuests,questReady} from '../shared/content.js';
import {lineOfSight} from '../shared/props.js';
import {emoteReply,spokenReply,npcReaction} from './npc-dialogue.js';
import {LIVE_DIALOGUE} from '../shared/live-content.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class SocialSystem{
 constructor(world){this.world=world;this.sequence=0;this.responses=[];this.ambient=new AmbientSocial(this);}
 initialize(p,saved){Object.assign(p,normalizeSocial(saved));p.lastEmote=-100;p.emote=null;}
 discover(p,id,amount=0){if(!Object.hasOwn(FACTIONS,id))return;const old=p.reputation[id];p.reputation[id]=Math.max(-600,Math.min(10000,(old||0)+amount));if(old===undefined||amount)this.world.notify(p,`${FACTIONS[id].name}: ${amount?`${amount>0?'+':''}${amount} reputation`:'discovered'}.`,'good');}
 claim(p,id){if(p.socialClaims.includes(id))return false;p.socialClaims.push(id);return true;}
 friendly(p,e){return ENEMY_TYPES[e.type]?.factionId===PEACE_FACTION&&((e.peace?.get(p.id)||0)>this.world.time||((p.reputation[PEACE_FACTION]||0)>=300&&!e.tags.has(p.id)));}
 perform(p,id,targetId=p.target,audience='auto'){
  const w=this.world,e=EMOTES[id];if(!e||!knowsEmote(p,id))return w.notify(p,'You have not learned that emote. Open Skills → Emotes to see how to learn it.');
  if(p.hp<=0)return;if(w.time-p.lastEmote<1.2)return w.notify(p,'Give that gesture a moment.');
  if(p.casting||p.auto&&w.enemy(p.target)?.hp>0||w.time-p.lastCombat<3)return w.notify(p,'Finish fighting or casting before using an emote.');
  const candidate=targetId?w.unit(targetId):null,valid=candidate&&candidate.hp>0&&candidate!==p&&distance(p,candidate)<=EMOTE_TARGET_RANGE&&lineOfSight(p,candidate);
  if(audience==='target'&&!valid)return w.notify(p,'Select a living character within 15 paces and in sight, or use @nearby.');
  const target=audience==='nearby'||!valid?null:candidate;
  const witnesses=[...w.npcs,...w.enemies,...w.players.values()].filter(unit=>unit!==p&&unit.hp>0&&distance(p,unit)<=EMOTE_NOTICE_RANGE&&lineOfSight(p,unit));
  p.auto=false;p.lastEmote=w.time;this.play(p,id,target,undefined,{audience:target?'target':'nearby',noticedBy:(target?[target]:witnesses).map(v=>v.id)});
  if(target){this.respond(p,target,id);return;}
  // Players keep agency over their own responses. Nearby NPCs/creatures notice
  // the same public gesture; cap animated replies without losing quest recipients.
  const important=new Set(activeQuests(p).filter(q=>q.kind==='emote'&&q.target===id).map(q=>q.emoteTarget));
  const listeners=witnesses.filter(unit=>unit.role||unit.type).sort((a,b)=>Number(important.has(b.id)||important.has(b.type))-Number(important.has(a.id)||important.has(a.type))||distance(p,a)-distance(p,b)).slice(0,5);
  for(const unit of listeners)this.respond(p,unit,id);
 }
 respond(p,target,id){const w=this.world;
  if(target.role){this.discover(p,npcFaction(target));this.npcResponse(p,target,id);return;}
  if(!target.type){this.creditTarget(p,id,target);return;}
  const def=ENEMY_TYPES[target.type];if(def.factionId)this.discover(p,def.factionId);
  if(id==='soothe'&&def.factionId===PEACE_FACTION){
   if(target.hp<def.hp||target.evading||target.target&&target.target!==p.id){w.notify(p,'This creature is hurt or fighting someone else. Try an undisturbed prowler.');return;}
   target.peace??=new Map();target.peace.set(p.id,w.time+45);if(target.target===p.id)target.target=null;target.slamAt=0;
   if(this.claim(p,`soothe:${target.id}`))this.discover(p,PEACE_FACTION,50);
   this.creditTarget(p,id,target);this.queueResponse(target,p,'nod','The thorns settle. The creature makes room for you.');
  }else if(id==='taunt'){
   target.peace?.delete(p.id);if(def.factionId===PEACE_FACTION){this.discover(p,PEACE_FACTION,-75);target.tags.set(p.id,w.time);}
   target.emote=null;target.target=p.id;target.nextAttack=Math.max(target.nextAttack,w.time+1);w.notify(p,`${def.name} accepts your challenge!`);
  }else if(!target.target&&!target.evading)this.queueResponse(target,p,this.friendly(p,target)?'sniff':'growl',def.factionId===PEACE_FACTION?'The creature watches your hands. Perhaps a calming gesture would help.':undefined);
 }
 creditTarget(p,id,target){for(const q of activeQuests(p))if(q.kind==='emote'&&q.target===id&&!questReady(p,q)&&(q.emoteTarget===target.id||q.emoteTarget===target.type)){
  const record=p.quests[q.id];if(!record.gathered.includes(target.id)){record.gathered.push(target.id);record.progress=Math.min(q.count,record.progress+1);this.world.notify(p,`${q.objective}: ${record.progress}/${q.count}`,'good');}
 }}
 play(unit,id,target,speech,context={}){const w=this.world;unit.emote={id,sequence:++this.sequence,startedAt:w.time,endsAt:w.time+EMOTES[id].duration,target:target?.id||null};w.events.push({type:'social',source:unit.id,target:target?.id||null,emote:id,text:emoteText(unit.name||ENEMY_TYPES[unit.type]?.name,id,target?.name||ENEMY_TYPES[target?.type]?.name),speech,x:unit.x,z:unit.z,...unit.emote,...context});}
 queueResponse(unit,target,id,speech,context={}){
  const w=this.world;if(context.ambient&&(unit.socialBusyUntil||0)>w.time)return;
  // A deliberate player gesture supersedes an unfinished ambient exchange.
  if(unit.role&&!context.ambient){unit.faceUntil=Math.max(unit.faceUntil||0,w.time+6);unit.facing=Math.atan2(target.x-unit.x,target.z-unit.z);}
  if(!context.ambient)this.responses=this.responses.filter(r=>r.source!==unit.id||!r.context.ambient);
  if(this.responses.some(r=>r.source===unit.id))return;
  unit.socialBusyUntil=w.time+4;unit.nextAmbient=Math.max(unit.nextAmbient||0,w.time+18);
  this.responses.push({at:w.time+.55,source:unit.id,target:target.id,id,speech,context});
 }
 npcResponse(p,npc,id){const w=this.world;this.creditTarget(p,id,npc);
  if(['bow','wave','thank','nod','salute'].includes(id)&&this.claim(p,`respect:${npc.id}`))this.discover(p,npcFaction(npc),15);
  if((npc.nextSocial||0)>w.time)return;npc.nextSocial=w.time+3;
  let {emote:reply,speech}=emoteReply(npc,p,id);
  speech=LIVE_DIALOGUE[npc.id]?.reply??npcReaction(this,p,npc,id,speech);
  this.queueResponse(npc,p,reply,speech);
 }
 hearSay(p,text){const w=this.world;if(p.hp<=0||w.time-(p.lastNPCSpeech??-100)<4)return;
  const listeners=w.npcs.filter(n=>n.hp>0&&distance(p,n)<=12&&lineOfSight(p,n));
  const named=listeners.find(n=>text.toLowerCase().includes(n.name.toLowerCase()));
  const npc=named||listeners.find(n=>n.id===p.target)||listeners.sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(!npc||(npc.nextSocial||0)>w.time)return;
  p.lastNPCSpeech=w.time;npc.nextSocial=w.time+4;const reply=spokenReply(npc,p,text);this.discover(p,npcFaction(npc));
  this.queueResponse(npc,p,reply.emote,LIVE_DIALOGUE[npc.id]?.reply??reply.speech,{conversation:true});
 }
 step(){const w=this.world;
  for(const r of this.responses.splice(0)){if(r.at>w.time){this.responses.push(r);continue;}const unit=w.unit(r.source),target=w.unit(r.target);if(unit&&target&&unit.hp>0&&target.hp>0&&!unit.target&&!unit.evading&&distance(unit,target)<=EMOTE_TARGET_RANGE&&lineOfSight(unit,target)){unit.facing=Math.atan2(target.x-unit.x,target.z-unit.z);if(unit.role)unit.faceUntil=w.time+6;this.play(unit,r.id,target,r.speech,r.context);}}
  for(const unit of [...w.npcs,...w.enemies,...w.players.values()])if(unit.emote?.endsAt<=w.time)unit.emote=null;
  for(const npc of w.npcs)if(!npc.routineId&&(npc.faceUntil||0)<w.time)npc.facing=npc.homeFacing;
  for(const p of w.players.values())if(p.emote&&(p.hp<=0||p.auto||p.casting||(p.sequenced?(p.latestMove.x||p.latestMove.z):w.time-p.inputAt<.3&&(p.input.x||p.input.z))||p.grounded===false))p.emote=null;
  this.ambient.step();
 }
}
