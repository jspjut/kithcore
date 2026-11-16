import {roamCreature} from './creature-roaming.js';
import {MAILBOXES} from '../shared/mail.js';
import {WORLD_INFO} from '../shared/world-info.js';
import {NPCRoutines} from './npc-routines.js';
import {ZoneIndex} from './zone-index.js';
import {regionAt,interestAt,interestedIn} from '../shared/zone-regions.js';
import {capitalTopics} from '../shared/capital-story.js';
import {TravelSystem} from './travel.js';
import {READABLES,readableAvailable,readingEvent,GATHER_READINGS} from '../shared/readables.js';
import {GATHER_CAST_TIME,gatherAvailable,gatherLabel} from '../shared/gathering.js';
import {LAYOUT_REVISION,migratePosition,ZONE_EXITS,zoneAt,ZONE_BOUNDS,withinZone} from '../shared/zone-layout.js';
import {waypointFor} from '../shared/travel.js';
import {SocialSystem} from './social.js';
import {ChatSystem} from './chat.js';
import {EMOTES,npcFaction,SOCIAL_RANGE} from '../shared/social.js';
import {BANK_CAPACITY,normalizeBank,transferBankItem} from '../shared/storage.js';
import { randomUUID } from 'node:crypto';
import { settleOnSurface,lineOfSight } from '../shared/props.js';
import {normalizeIdentity,classDefinition,classSkills,learnedSkill,armorAllowed} from '../shared/adventurers.js';
import { characterLook,normalizeAppearance } from '../shared/character.js';
import { MOVE_STEP, MOVE_BUDGET, MAX_MOVE_QUEUE, normalizeInput, advanceMotion } from '../shared/movement.js';
import { ZONE, GLOBAL_COOLDOWN, QUESTS, NPCS, GATHERABLES, ENEMY_TYPES, ENEMY_SPAWNS, SKILLS, ITEMS, equipmentSlot, emptyEquipment, normalizeEquipment, defaultEquipmentSlot, canEquipInSlot, visibleEquipment, BAG_EQUIP_SLOTS, MERCHANT_STOCK, RESOURCE_TYPES, inventoryCapacity, storedItemCount, bagEntries, canAddItem, stats, heightAt, walkable, levelForXP, questForPlayer, questAvailable, questRecord, activeQuests, questReady } from '../shared/content.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export class World {
  constructor() {
    this.time = 0;this.zones=new ZoneIndex();
    this.players = new Map();
    this.npcs=NPCS.map(n=>this.createNPC(n));this.social=new SocialSystem(this);this.travel=new TravelSystem(this);this.parties=new Map();this.partyInvites=new Map();this.nextParty=1;
    this.routines=new NPCRoutines(this);
    this.events = [];this.chat=new ChatSystem(this);
    this.enemies = ENEMY_SPAWNS.map((s, i) => this.spawn(s, s.id||`mob-${i}`));
  }
  createNPC(n){return {...n,homeFacing:n.facing??Math.atan2(-n.x,29-n.z),facing:n.facing??Math.atan2(-n.x,29-n.z),hp:n.featured?12000:180,maxHp:n.featured?12000:180,level:n.featured?100:6};}
  addLiveActors(additions){this.npcs.push(...additions.npcs.map(n=>this.createNPC(n)));this.enemies.push(...additions.spawns.map(s=>this.spawn(s,s.id)));}
  spawn(s, id) {
    return { id, type: s.type, x: s.x, z: s.z, homeX: s.x, homeZ: s.z, hp: ENEMY_TYPES[s.type].hp, target: null, nextAttack: 0, nextSlam: 0, slamAt: 0, deadUntil: 0, tags: new Map(), loot: new Set(), lootContents: new Map(), facing: 0, evading: false };
  }
  addPlayer(name, saved) {
    if(saved?.worldId&&saved.worldId!==WORLD_INFO.id)throw Error('This character belongs to another world.');
    const identity=normalizeIdentity(saved),definition=classDefinition(identity.classId);
    const p = {
      id: saved?.id || randomUUID(), name, ...ZONE.spawn, facing: 0, level: 1, xp: 0, hp: 120, energy: 100, gold: 0,
      inventory: { [definition.starterWeapon]:1,[definition.starterArmor]:1,potion:3 }, equipment: {...emptyEquipment(),weapon:definition.starterWeapon,armor:definition.starterArmor},
      quests: {}, trackedQuest: null, bags:Array(BAG_EQUIP_SLOTS).fill(null),
      ...saved,...identity,
      input: { x: 0, z: 0 }, inputAt: 0, target: null, auto: false, cooldowns: {}, nextAttack: 0, lastCombat: -100, deadAt: 0,
      jumpHeight: 0, jumpVelocity: 0, casting: null, shield:0,shieldUntil:0, globalCooldown:null, lastCastRequest: 0, targetSeq:0, autoSeq:0,
      partyId:null,lastInvite:-100,motionEpoch: 0, lastInputSeq: 0, lastQueuedSeq: 0, moveQueue: [], moveCredit: 0, sequenced: false, lastMoveAt: 0, latestMove: {x:0,z:0}
    };
    if(saved&&Number.isFinite(saved.x)&&saved.layoutRevision!==LAYOUT_REVISION){Object.assign(p,migratePosition(saved));if(!withinZone(p.x,p.z)){p.x=Math.max(ZONE_BOUNDS.minX+3,Math.min(ZONE_BOUNDS.maxX-3,p.x));p.z=Math.max(ZONE_BOUNDS.minZ+3,Math.min(ZONE_BOUNDS.maxZ-3,p.z));}delete p.y;}p.layoutRevision=LAYOUT_REVISION;
    this.travel.initialize(p,saved);
    if(!settleOnSurface(p)){Object.assign(p,ZONE.spawn);delete p.y;settleOnSurface(p);}
    p.mapId=zoneAt(p.x,p.z);this.social.initialize(p,saved);
    p.equipment=normalizeEquipment(p.equipment,p.inventory);
    p.bank=normalizeBank(saved?.bank);p.bankNpcId=null;
    p.look=characterLook(p.look);p.appearance=normalizeAppearance(p.appearance,p.look);
    p.level = levelForXP(p.xp);
    p.hp = Math.max(1, Math.min(p.hp, stats(p).maxHp));
    const equipped={};p.bags=Array.from({length:BAG_EQUIP_SLOTS},(_,i)=>{const id=p.bags?.[i];if(!ITEMS[id]?.bagSlots||(equipped[id]||0)>=(p.inventory[id]||0))return null;equipped[id]=(equipped[id]||0)+1;return id;});
    p.harvestReady=Object.fromEntries(Object.entries(saved?.harvestCooldowns||{}).filter(([id,seconds])=>GATHERABLES.some(g=>g.id===id&&RESOURCE_TYPES[g.type])&&Number.isFinite(seconds)&&seconds>0).map(([id,seconds])=>[id,this.time+Math.min(60,seconds)]));
    // Older saves counted quest loot directly. Preserve that progress as items.
    for (const q of activeQuests(p)) if (q.dropItem) p.inventory[q.dropItem] = Math.max(p.inventory[q.dropItem] || 0,questRecord(p,q).progress);
    this.players.set(p.id, p);
    return p;
  }
  save(p) {
    const { id, name, look, appearance, raceId, classId, x, z, y, facing, level, xp, hp, energy, gold, inventory, equipment, quests, trackedQuest, bags, hearthNpcId, bank, emotes, reputation, socialClaims } = p;
    const harvestCooldowns=Object.fromEntries(Object.entries(p.harvestReady).filter(([,ready])=>ready>this.time).map(([id,ready])=>[id,ready-this.time]));
    return { id, name, look, appearance, raceId, classId, x, z, y, facing, level, xp, hp, energy, gold, inventory, equipment, quests, trackedQuest, bags, hearthNpcId, bank, harvestCooldowns,emotes,reputation,socialClaims,mapId:zoneAt(x,z),layoutRevision:LAYOUT_REVISION,worldId:WORLD_INFO.id,contentVersion:WORLD_INFO.version,...this.travel.save(p) };
  }
  notify(p, text, tone = 'info') { this.events.push({ type: 'notice', to: p.id, text, tone }); }
  effect(kind, source, target, amount) {const a=this.unit(source),b=this.unit(target)||GATHERABLES.find(g=>g.id===target),point=b||a||ZONE.spawn;this.events.push({ type: 'effect', kind, source, target, amount,x:point.x,z:point.z,regions:[...new Set([a,b].filter(Boolean).map(v=>regionAt(v.x,v.z)))] });this.social.ambient.observeEffect(kind,source,target,amount); }
  enemy(id) { return this.enemies.find(e => e.id === id); }
  command(p, msg) {
    if (!p || !msg || typeof msg !== 'object') return;
    if(msg.type==='gmTravel')return this.travel.explore(p,msg);
    if(p.storageBusy&&!['move','input','target','cancelCast'].includes(msg.type))return;
    if (msg.type === 'move') {
      if(p.transit)return;
      if (p.hp<=0||msg.epoch!==p.motionEpoch||!Array.isArray(msg.commands)||!msg.commands.length||msg.commands.length>6||p.moveQueue.length+msg.commands.length>MAX_MOVE_QUEUE)return;
      const batch=[];let previous=p.lastQueuedSeq;
      for(const c of msg.commands){const input=normalizeInput(c);if(!input||!Number.isSafeInteger(c.seq)||c.seq!==previous+1)return;batch.push({...input,seq:c.seq});previous=c.seq;}
      p.sequenced=true;p.moveQueue.push(...batch);p.lastQueuedSeq=previous;p.lastMoveAt=this.time;p.latestMove=batch.at(-1);return;
    }
    if (msg.type === 'input') {
      if(p.transit)return;
      if(p.sequenced)return;
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.z)) return;
      const len = Math.max(1, Math.hypot(msg.x, msg.z));
      p.input = { x: msg.x / len, z: msg.z / len }; p.inputAt = this.time;
      if(p.input.x||p.input.z)this.cancelCast(p);
      return;
    }
    if (msg.type === 'target') {const unit=this.unit(msg.id);p.target=unit&&interestedIn(p,unit)?unit.id:null;if(msg.passive===true||!this.enemy(p.target))p.auto=false;if(Number.isSafeInteger(msg.seq))p.targetSeq=Math.max(p.targetSeq,msg.seq);return;}
    if(msg.type==='party')return this.partyAction(p,msg);
    if (msg.type === 'respawn') { if (p.hp <= 0 && this.time - p.deadAt >= 5) this.respawn(p); return; }
    if (p.hp <= 0) return;
    if(p.transit)return;
    if(msg.type==='travel')return this.travel.depart(p,msg);
    if(msg.type==='npcTopic')return this.npcTopic(p,msg);
    if(msg.type==='waypoint')return this.travel.bind(p,msg);
    if(msg.type==='emote')return this.social.perform(p,msg.id,undefined,msg.audience);
    if(msg.type==='bank')return this.bankAction(p,msg);
    if (msg.type === 'jump') {
      this.cancelCast(p);
      if (p.grounded && p.jumpVelocity === 0){p.jumpVelocity=7.5;p.grounded=false;}
      return;
    }
    if (msg.type === 'auto') { p.auto = typeof msg.enabled === 'boolean' ? msg.enabled : !p.auto;if(Number.isSafeInteger(msg.seq))p.autoSeq=Math.max(p.autoSeq,msg.seq); return; }
    if (msg.type === 'skill') return this.skill(p, msg.skill, msg.requestId);
    if (msg.type === 'cancelCast') { if(!msg.requestId||p.casting?.requestId===msg.requestId)this.cancelCast(p);return; }
    if (msg.type === 'interact') return this.interact(p, msg.id, msg.autoLoot === true,msg.requestId);
    if (msg.type === 'loot') return this.takeLoot(p, msg.id, msg.slot);
    if (msg.type === 'quest') return this.quest(p, msg.action, msg.id);
    if (msg.type === 'trackQuest' && questRecord(p, msg.id)?.status === 'active') { p.trackedQuest = msg.id; return; }
    if(msg.type==='equipBag')return this.equipBag(p,msg.item,msg.index);
    if(msg.type==='unequipBag'){
      if(!Number.isInteger(msg.index)||msg.index<0||msg.index>=BAG_EQUIP_SLOTS||!p.bags[msg.index])return;
      const bags=[...p.bags];bags[msg.index]=null;
      if(bagEntries({...p,bags}).length>inventoryCapacity({...p,bags}))return this.notify(p,'Empty some storage before removing this bag.');
      p.bags=bags;return;
    }
    if (msg.type === 'equip') {
      const item=ITEMS[msg.item],slot=msg.slot===undefined?defaultEquipmentSlot(p,item):msg.slot;
      if(!item?.slot||!canEquipInSlot(item,slot))return;
      if(!armorAllowed(p.classId,item.armorType)||item.allowedClasses&&!item.allowedClasses.includes(p.classId))return this.notify(p,'That equipment is not compatible with your class.');
      if(p.equipment[slot]===msg.item)return;
      if(storedItemCount(p,msg.item)<1)return;
      p.equipment[slot]=msg.item;p.hp=Math.min(p.hp,stats(p).maxHp);
      this.notify(p,`Equipped ${item.name} in ${equipmentSlot(slot).name}.`,'good');return;
    }
    if(msg.type==='unequip'&&equipmentSlot(msg.slot)){
      if(!p.equipment[msg.slot])return;
      const equipment={...p.equipment,[msg.slot]:null};
      if(bagEntries({...p,equipment}).length>inventoryCapacity(p))return this.notify(p,'Your bags are full.');
      p.equipment=equipment;p.hp=Math.min(p.hp,stats(p).maxHp);return;
    }
    if (msg.type === 'potion') {
      const item=msg.item||'potion';if(!ITEMS[item]?.consumable)return;
      if (!p.inventory[item]) return this.notify(p, 'You have no healing tonics. Visit a merchant.');
      if ((p.cooldowns.potion || 0) > this.time) return this.notify(p, 'Your tonic is not ready yet.');
      if (p.hp >= stats(p).maxHp) return this.notify(p, 'You are already at full health.');
      p.inventory[item]--; p.cooldowns.potion = this.time + 8;
      this.heal(p, 80); return;
    }
    if (msg.type === 'trade') {
      if (Math.min(...this.npcs.filter(n=>n.role==='merchant').map(n=>distance(p,n))) > 5) return this.notify(p, 'Move closer to a provisioner to trade.');
      for(const n of this.npcs)if(n.role==='merchant'&&distance(p,n)<=5)n.faceUntil=this.time+20;
      if (msg.action === 'buy') {
        const id=msg.item||'potion',item=ITEMS[id];if(!MERCHANT_STOCK.includes(id))return;
        if(p.level<(item.minLevel||1))return this.notify(p,`Requires level ${item.minLevel}.`);
        if (p.gold < item.price) return this.notify(p, `${item.name} costs ${item.price} copper.`);
        if (!canAddItem(p,id)) return this.notify(p,'Your bags are full.');
        p.gold -= item.price; p.inventory[id] = (p.inventory[id] || 0) + 1;
        this.notify(p, `Bought ${item.name}.`, 'good');
      } else if (msg.action === 'sell') {
        let gold = 0;
        for (const [id, count] of Object.entries(p.inventory)) if (ITEMS[id]?.sell && !ITEMS[id].slot && !ITEMS[id].bagSlots && !ITEMS[id].consumable && !ITEMS[id].quest) { gold += ITEMS[id].sell * count; delete p.inventory[id]; }
        p.gold += gold; this.notify(p, gold ? `Sold trade goods for ${gold} copper.` : 'No trade goods to sell.', 'good');
      } else if (msg.action === 'sellItem') {
        const item=ITEMS[msg.item],available=storedItemCount(p,msg.item);
        if (!item?.sell || item.quest || available<=0) return;
        const requested=Math.max(1,Math.min(item.slot||item.bagSlots?1:99,Math.floor(Number(msg.count)||99)));
        const count=msg.all===true?Math.min(available,requested):1;p.inventory[msg.item]-=count;p.gold+=item.sell*count;
        this.notify(p,`Sold ${item.name}${count>1?` ×${count}`:''}.`,'good');
      }
    }
  }
  bankAccess(p,npcId=p.bankNpcId){return this.npcs.find(n=>n.id===npcId&&(n.role==='banker'||n.services?.includes('bank'))&&n.hp>0&&p.hp>0&&distance(p,n)<=5);}
  bankView(p){const npc=this.bankAccess(p);if(!npc){p.bankNpcId=null;return null;}return {npcId:npc.id,name:npc.name,capacity:BANK_CAPACITY,inventory:{...p.bank}};}
  bankAction(p,msg){
    if(msg.action==='close'){p.bankNpcId=null;return;}
    if(msg.action==='open'){const npc=this.bankAccess(p,msg.npcId);if(!npc)return this.notify(p,'Visit a banker in a major town to access your bank.');p.bankNpcId=npc.id;return;}
    if(!this.bankAccess(p)){p.bankNpcId=null;return this.notify(p,'Your bank is only accessible while visiting a banker.');}
    const result=transferBankItem(p,msg.action,msg.item,msg.count===undefined?1:msg.count);
    if(result.error)return this.notify(p,result.error);
    this.notify(p,`${msg.action==='deposit'?'Stored':'Withdrew'} ${ITEMS[msg.item].name} ×${result.amount}.`,'good');
  }
  unit(id){return this.enemy(id)||this.players.get(id)||this.npcs.find(n=>n.id===id);}
  partySnapshot(p){const party=this.parties.get(p.partyId);return party?{id:p.partyId,leader:party.members[0],members:[...party.members],units:party.members.map(id=>this.players.get(id)).filter(Boolean).map(v=>({id:v.id,name:v.name,level:v.level,classId:v.classId,hp:v.hp,maxHp:stats(v).maxHp,mapId:zoneAt(v.x,v.z)}))}:null;}
  inviteSnapshot(p){const invite=this.partyInvites.get(p.id),from=invite&&this.players.get(invite.from);if(!from||invite.expires<=this.time)return null;return {from:from.id,name:from.name,expires:invite.expires};}
  partyAction(p,msg){
    if(msg.action==='leave'){this.leaveParty(p);return;}
    if(msg.action==='decline'){this.partyInvites.delete(p.id);return;}
    if(msg.action==='invite'){
      const other=this.players.get(msg.id),party=this.parties.get(p.partyId);
      if(!other||other===p||other.partyId)return this.notify(p,'Select an ungrouped player to invite.');
      if(party&&(party.members[0]!==p.id||party.members.length>=5))return this.notify(p,'Only the leader can invite, up to five players.');
      if(this.time-p.lastInvite<3)return this.notify(p,'Wait a moment before inviting again.');
      p.lastInvite=this.time;this.partyInvites.set(other.id,{from:p.id,expires:this.time+30});this.notify(p,`Invited ${other.name}.`,'good');return;
    }
    if(msg.action!=='accept'||p.partyId)return;
    const invite=this.partyInvites.get(p.id);this.partyInvites.delete(p.id);const from=invite&&this.players.get(invite.from);
    if(!from||invite.expires<=this.time)return this.notify(p,'That invitation has expired.');
    let party=this.parties.get(from.partyId);
    if(party&&(party.members[0]!==from.id||party.members.length>=5))return this.notify(p,'That party is no longer available.');
    if(!party){from.partyId=`party-${this.nextParty++}`;party={members:[from.id]};this.parties.set(from.partyId,party);}
    party.members.push(p.id);p.partyId=from.partyId;this.notify(p,'You joined the party.','good');this.notify(from,`${p.name} joined your party.`,'good');
  }
  leaveParty(p){
    const party=this.parties.get(p.partyId),id=p.partyId;p.partyId=null;if(!party)return;
    party.members=party.members.filter(member=>member!==p.id);
    if(party.members.length<2){for(const member of party.members){const other=this.players.get(member);if(other)other.partyId=null;}this.parties.delete(id);}
  }
  removePlayer(id){const p=this.players.get(id);if(p)this.leaveParty(p);this.social.ambient.forget(id);this.players.delete(id);for(const e of this.enemies)e.peace?.delete(id);this.partyInvites.delete(id);for(const [to,invite]of this.partyInvites)if(invite.from===id)this.partyInvites.delete(to);}
  equipBag(p,id,index){
    const item=ITEMS[id];if(!item?.bagSlots||storedItemCount(p,id)<1)return;
    if(p.level<(item.minLevel||1))return this.notify(p,`Requires level ${item.minLevel} to equip ${item.name}.`);
    if(index===undefined){index=p.bags.indexOf(null);if(index<0){index=p.bags.reduce((best,bag,i)=>ITEMS[bag].bagSlots<ITEMS[p.bags[best]].bagSlots?i:best,0);if(item.bagSlots<=ITEMS[p.bags[index]].bagSlots)return this.notify(p,'Drag this bag onto the bag slot you want to replace.');}}
    if(!Number.isInteger(index)||index<0||index>=BAG_EQUIP_SLOTS)return;
    const bags=[...p.bags];bags[index]=id;
    if(bagEntries({...p,bags}).length>inventoryCapacity({...p,bags}))return this.notify(p,'Your items will not fit in the smaller bags.');
    p.bags=bags;this.notify(p,`Equipped ${item.name}. ${inventoryCapacity(p)} total storage slots.`,'good');
  }
  skill(p, id, requestId=0) {
    const s = SKILLS[id];
    if(Number.isSafeInteger(requestId)&&requestId>0){if(requestId<=p.lastCastRequest)return;p.lastCastRequest=requestId;}else requestId=0;
    if (!s || !learnedSkill(p,id)) return this.notify(p, 'That skill has not been learned yet.');
    if(p.casting)return;
    if(s.travel&&!this.travel.canReturn(p))return;
    if((p.globalCooldown?.endsAt||0)>this.time)return this.notify(p,'Global cooldown is not ready yet.');
    if ((p.cooldowns[id] || 0) > this.time) return this.notify(p, `${s.name} is not ready yet.`);
    if (p.energy < s.cost) return this.notify(p, `You need more ${classDefinition(p.classId).resource.toLowerCase()}.`);
    const targets=this.skillTargets(p,id,p.target);if(!targets)return;
    if(s.castTime){
      const input=p.sequenced?p.latestMove:this.time-p.inputAt<.3?p.input:{x:0,z:0};
      if(input.x||input.z||p.grounded===false||p.jumpHeight>0||p.jumpVelocity>0||p.moveQueue.some(c=>c.jump))return this.notify(p,'You must stand still to cast.');
    }
    if(s.triggersGCD!==false)p.globalCooldown={requestId,startedAt:this.time,endsAt:this.time+GLOBAL_COOLDOWN};
    if(s.castTime){p.casting={skill:id,requestId,target:s.heal||s.shield?targets[0].id:p.target,startedAt:this.time,endsAt:this.time+s.castTime,startSeq:p.lastQueuedSeq};return;}
    this.applySkill(p,id,targets);
  }
  skillTargets(p,id,targetId){
    const s=SKILLS[id];let targets = [];if(s.travel)return [p];
    if(s.partyHeal){
      const members=new Set(this.parties.get(p.partyId)?.members||[p.id]);
      return [...this.players.values()].filter(v=>members.has(v.id)&&v.hp>0&&distance(p,v)<=s.range&&(v===p||lineOfSight(p,v)));
    }
    if(s.selfOnly||s.shield&&!s.friendlyTarget)return [p];
    if(s.heal||s.friendlyTarget){
      const target=targetId==null||this.enemy(targetId)?p:this.players.get(targetId)||(s.heal?this.npcs.find(n=>n.id===targetId):null);
      if(!target||target.hp<=0){this.notify(p,s.shield?'Select a living friendly player.':'Select a living friendly target.');return null;}
      if(target!==p&&distance(p,target)>s.range){this.notify(p,'Your friendly target is out of range.');return null;}
      if(target!==p&&!lineOfSight(p,target)){this.notify(p,'Your friendly target is behind a wall.');return null;}
      targets=[target];
    }else if (s.area&&!s.targetArea) {
      targets = this.enemies.filter(e => e.hp > 0 && !e.evading && distance(p, e) <= s.range && lineOfSight(p,e));
      if (!targets.length) {this.notify(p, `There are no enemies within ${s.range} paces.`);return null;}
    } else {
      const e = this.enemy(targetId);
      if (!e || e.hp <= 0) {this.notify(p, 'Select a living enemy first.');return null;}
      if (e.evading) {this.notify(p, 'That enemy is retreating.');return null;}
      if (distance(p, e) > s.range) {this.notify(p, 'Your target is out of range.');return null;}
      if(!lineOfSight(p,e)){this.notify(p,'Your target is behind a wall.');return null;}
      targets = s.targetArea?this.enemies.filter(v=>v.hp>0&&!v.evading&&distance(e,v)<=s.radius&&lineOfSight(p,v)):s.chain?[e,...this.enemies.filter(v=>v!==e&&v.hp>0&&!v.evading&&distance(e,v)<=7&&lineOfSight(e,v)).slice(0,s.chain-1)]:[e];
    }
    return targets;
  }
  applySkill(p,id,targets){
    const s=SKILLS[id];if(s.travel){this.travel.complete(p);return;}p.energy -= s.cost; p.cooldowns[id] = this.time + s.cooldown;
    if(s.shield)for(const target of targets){target.shield=s.shield+p.level*5;target.shieldUntil=this.time+8;this.effect('ward',p.id,target.id,target.shield);}
    if(s.heal)for(const target of targets)this.heal(target,s.heal+p.level*5,p.id);
    this.credit(p, 'skill', id);
    if(s.heal||s.shield)return;
    for (const e of targets) { this.hit(p,e,(s.damage||0)+stats(p).power,id);if(s.slow&&e.hp>0){e.slow=s.slow;e.slowUntil=this.time+3;} }
    if (targets.length) p.auto = true;
  }
  releaseCastCooldown(p,cast){if(cast.kind!=='gather'&&p.globalCooldown?.requestId===cast.requestId&&p.globalCooldown.startedAt===cast.startedAt)p.globalCooldown=null;}
  cancelCast(p){if(p.casting){this.releaseCastCooldown(p,p.casting);p.casting=null;this.notify(p,'Interrupted.');}}
  finishCast(p){
    const cast=p.casting;p.casting=null;if(!cast||p.hp<=0)return;
    if(cast.kind==='gather'){this.collectGroundObject(p,cast.target);return;}
    const s=SKILLS[cast.skill],targets=this.skillTargets(p,cast.skill,cast.target);
    if(!targets||p.energy<s.cost){this.releaseCastCooldown(p,cast);return;}
    this.applySkill(p,cast.skill,targets);
  }
  resetMotion(p){p.motionEpoch++;p.moveQueue=[];p.moveCredit=0;p.lastInputSeq=0;p.lastQueuedSeq=0;p.latestMove={x:0,z:0};settleOnSurface(p);p.casting=null;p.globalCooldown=null;}
  heal(p,n,source=p.id){const before=p.hp;p.hp=Math.min(p.maxHp||stats(p).maxHp,p.hp+n);this.effect('heal',source,p.id,Math.round(p.hp-before));}
  hit(p, e, damage, kind = 'attack') {
    if (e.hp <= 0 || e.evading) return;
    if(e.peace?.has(p.id)||this.social.friendly(p,e)){e.peace?.delete(p.id);if(ENEMY_TYPES[e.type].factionId)this.social.discover(p,ENEMY_TYPES[e.type].factionId,-100);}
    p.emote=null;e.emote=null;e.tags.set(p.id, this.time); e.target ||= p.id; p.lastCombat = this.time;
    p.facing = Math.atan2(e.x - p.x, e.z - p.z);
    e.hp = Math.max(0, e.hp - damage);
    this.effect(kind, p.id, e.id, damage);
    if (e.hp === 0) {
      this.social.ambient.victory(p,e);
      e.deadUntil = this.time + (ENEMY_TYPES[e.type].boss ? 60 : 30); e.slamAt = 0; e.target = null;
      for (const [id, at] of e.tags) {
        const member = this.players.get(id);
        if (!member || member.hp <= 0 || this.time - at > 40 || distance(member, e) > 30) continue;
        e.loot.add(id);
        const def=ENEMY_TYPES[e.type];
        const items=[{key:def.loot,item:def.loot,count:1}];
        for (const q of activeQuests(member)) if(q.kind==='loot'&&q.target===e.type&&!questReady(member,q)) items.push({key:q.id,item:q.dropItem,count:1,questId:q.id});
        e.lootContents.set(id,{coins:def.level*2+1,items});
        const difference = member.level - ENEMY_TYPES[e.type].level;
        const factor = difference >= 4 ? 0 : difference === 3 ? .35 : difference === 2 ? .65 : 1;
        this.gainXP(member, Math.round(ENEMY_TYPES[e.type].xp * factor));
        this.credit(member, 'kill', e.type);
      }
    }
  }
  gainXP(p, xp) {
    p.xp += xp;
    const next = levelForXP(p.xp);
    if (next > p.level) {
      p.level = next; p.hp = stats(p).maxHp; p.energy = 100;
      this.effect('level', p.id, p.id, next);
      const learned=classSkills(p).filter(id=>SKILLS[id].level===next).map(id=>SKILLS[id].name);this.notify(p,`Level ${next}!${learned.length?' Learned '+learned.join(', ')+'.':''}`,'good');
    }
  }
  credit(p, kind, target, objectId = null) {
    for (const q of activeQuests(p)) {
      const record = questRecord(p, q);
      if (q.kind !== kind || q.target !== target || record.progress >= q.count) continue;
      if (objectId && record.gathered.includes(objectId)) continue;
      if (objectId) record.gathered.push(objectId);
      record.progress = Math.min(q.count, record.progress + 1);
      this.notify(p, `${q.objective}: ${record.progress}/${q.count}`, 'good');
    }
  }
  lootView(p,e) {
    const contents=e.lootContents.get(p.id);
    this.events.push({type:'loot',to:p.id,id:e.id,name:ENEMY_TYPES[e.type].name,coins:contents?.coins||0,items:contents?.items||[]});
  }
  takeLoot(p,id,slot) {
    const e=this.enemy(id),contents=e?.lootContents.get(p.id);
    if(!e||e.hp>0||!e.loot.has(p.id)||!contents||distance(p,e)>4.8)return this.notify(p,'Move closer to the remains to loot.');
    if(slot==='all'||slot==='coins'){p.gold+=contents.coins;contents.coins=0;}
    for(const entry of [...contents.items]) {
      if(slot!=='all'&&slot!==entry.key)continue;
      const q=entry.questId?QUESTS.find(q=>q.id===entry.questId):null;
      if(q&&(questRecord(p,q)?.status!=='active'||questReady(p,q))){contents.items=contents.items.filter(v=>v!==entry);continue;}
      if(!canAddItem(p,entry.item,entry.count)){this.notify(p,'Your backpack is full. The item remains on the corpse.');continue;}
      p.inventory[entry.item]=(p.inventory[entry.item]||0)+entry.count;
      if(q){const record=questRecord(p,q);record.progress=Math.min(q.count,record.progress+entry.count);this.notify(p,`${q.objective}: ${record.progress}/${q.count}`,'good');}
      contents.items=contents.items.filter(v=>v!==entry);
      this.notify(p,`Received ${ITEMS[entry.item].name}.`,'good');
    }
    if(!contents.coins&&!contents.items.length){e.loot.delete(p.id);e.lootContents.delete(p.id);}
    this.lootView(p,e);
  }
  npcTopic(p,msg){
    const n=this.npcs.find(n=>n.id===msg.npc),topic=n&&capitalTopics(n,p).find(t=>t.id===msg.topic);
    if(!topic||Math.hypot(p.x-n.x,p.z-n.z)>4.8||!lineOfSight(p,n))return this.notify(p,'Speak to that person nearby to continue the conversation.');
    if(this.time-(p.lastCityTopic??-100)<1)return;p.lastCityTopic=this.time;
    this.events.push({type:'reading',to:p.id,title:topic.heading,author:n.name,pages:[{heading:topic.heading,text:topic.text.replaceAll('{name}',p.name)}]});
    this.social.play(n,topic.emote,p,topic.speech.replaceAll('{name}',p.name),{conversation:true});
  }
  interact(p, id, autoLoot=false,requestId=0) {
    if(Number.isSafeInteger(requestId)&&requestId>0){if(requestId<=p.lastCastRequest)return;p.lastCastRequest=requestId;}else requestId=0;
    if(p.casting)return;
    const requestedReading=READABLES.find(r=>r.id===id);
    if(requestedReading&&!readableAvailable(p,requestedReading))return this.notify(p,'There is nothing posted here for you yet.');
    const candidates = [...MAILBOXES,...this.npcs, ...GATHERABLES, ...READABLES.filter(r=>readableAvailable(p,r)), ...this.enemies.filter(e => e.hp <= 0 && e.loot.has(p.id))];
    let obj = candidates.find(o => o.id === id);
    if (!obj) obj = candidates.filter(o => distance(p, o) <= 4.8).sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!obj || distance(p, obj) > 4.8) return this.notify(p, 'Move closer to a person, readable, crate, beacon, or fallen enemy.');
    if(obj.type==='mailbox'){this.correspondence?.open(p,obj.id);return;}
    if(obj.storyId){
      if(!lineOfSight(p,obj))return this.notify(p,'That text is behind a wall.');
      this.events.push(readingEvent(p,obj));return;
    }
    if (obj.role) {
      this.social.discover(p,npcFaction(obj));obj.facing=Math.atan2(p.x-obj.x,p.z-obj.z);obj.faceUntil=this.time+(obj.routineId?30:6);
      if(obj.role==='banker'||obj.services?.includes('bank'))return this.bankAction(p,{action:'open',npcId:obj.id});
      this.credit(p, 'deliver', obj.id);
      if (obj.role === 'healer') {p.hearthNpcId=obj.id; this.heal(p, stats(p).maxHp); p.energy = 100; this.notify(p, 'The hearth restores your strength.', 'good'); }
      this.events.push({ type: 'dialogue', to: p.id, npc: obj.id }); return;
    }
    if (obj.loot?.has(p.id)) {
      if(autoLoot)this.takeLoot(p,obj.id,'all');else this.lootView(p,obj);
      return;
    }
    if(!gatherAvailable(p,obj,this.time))return this.notify(p,RESOURCE_TYPES[obj.type]?'This resource is recovering. Come back shortly.':'No active task requires this object.');
    if(RESOURCE_TYPES[obj.type]&&!canAddItem(p,RESOURCE_TYPES[obj.type].item))return this.notify(p,'Your bags are full.');
    if(!lineOfSight(p,obj,obj.id))return this.notify(p,'That object is behind a wall.');
    const input=p.sequenced?p.latestMove:this.time-p.inputAt<.3?p.input:{x:0,z:0};
    if(input.x||input.z||p.grounded===false||p.jumpHeight>0||p.jumpVelocity>0||p.moveQueue.some(c=>c.jump))return this.notify(p,'You must stand still to gather.');
    p.auto=false;p.emote=null;p.casting={kind:'gather',skill:'gather',name:gatherLabel(obj),requestId,target:obj.id,startedAt:this.time,endsAt:this.time+GATHER_CAST_TIME,startSeq:p.lastQueuedSeq};
  }
  collectGroundObject(p,id){
    const obj=GATHERABLES.find(g=>g.id===id);if(!obj||distance(p,obj)>4.8||!lineOfSight(p,obj,obj.id)||!gatherAvailable(p,obj,this.time))return this.notify(p,'That object can no longer be gathered.');
    const resource=RESOURCE_TYPES[obj.type];
    if(resource){
      if((p.harvestReady[obj.id]||0)>this.time)return this.notify(p,'This resource is recovering. Come back shortly.');
      if(!canAddItem(p,resource.item))return this.notify(p,'Your bags are full.');
      p.inventory[resource.item]=(p.inventory[resource.item]||0)+1;p.harvestReady[obj.id]=this.time+resource.respawn;
      this.credit(p,'gather',obj.type,obj.id);this.effect('gather',p.id,obj.id,0);this.notify(p,`Gathered ${ITEMS[resource.item].name}.`,'good');return;
    }
    const relevant = activeQuests(p).filter(q => q.kind === 'gather' && q.target === obj.type && !questRecord(p,q).gathered.includes(obj.id) && !questReady(p,q));
    if (!relevant.length) return this.notify(p, 'No active task requires this object.');
    this.credit(p, 'gather', obj.type, obj.id); this.effect('gather', p.id, obj.id, 0);
    const reading=READABLES.find(r=>r.storyId===GATHER_READINGS[obj.id]);
    if(reading)this.events.push(readingEvent(p,reading));
  }
  quest(p, action, id) {
    const raw=QUESTS.find(q=>q.id===id),q=raw&&questForPlayer(p,raw);
    if (!q) return;
    if(action==='abandon'){
      if(questRecord(p,q)?.status!=='active')return;
      delete p.quests[q.id];
      if(q.dropItem&&ITEMS[q.dropItem]?.quest){const reserved=activeQuests(p).filter(other=>other.dropItem===q.dropItem).reduce((n,other)=>n+questRecord(p,other).progress,0);p.inventory[q.dropItem]=Math.min(p.inventory[q.dropItem]||0,reserved);if(!p.inventory[q.dropItem])delete p.inventory[q.dropItem];}
      if(p.trackedQuest===q.id)p.trackedQuest=activeQuests(p)[0]?.id||null;
      this.notify(p,`Quest abandoned: ${q.title}. You can accept it again from its giver.`);return;
    }
    if(action!=='accept'&&action!=='complete')return;
    const npc = NPCS.find(n => n.id === (action === 'accept' ? q.giver : q.turnIn));
    if (distance(p, npc) > 5) return this.notify(p, `Speak to ${npc.name} to ${action === 'accept' ? 'accept' : 'complete'} this quest.`);
    if (action === 'accept' && questAvailable(p,q)) {
      if (activeQuests(p).length >= 12) return this.notify(p, 'Your journal holds 12 active quests. Complete one first.');
      p.quests[q.id] = { status: 'active', progress: 0, gathered: [] }; p.trackedQuest ||= q.id;
      this.notify(p, `Quest accepted: ${q.title}`, 'good');
      if (q.kind === 'deliver' && q.target === npc.id) this.credit(p,'deliver',npc.id);
    } else if (action === 'complete' && questReady(p,q)) {
      if(q.dropItem&&(p.inventory[q.dropItem]||0)<q.count)return this.notify(p,'You still need the required quest items.');
      const afterTurnIn={...p,inventory:{...p.inventory}};
      if(q.dropItem)afterTurnIn.inventory[q.dropItem]-=q.count;
      if(q.reward&&!canAddItem(afterTurnIn,q.reward,q.rewardCount))return this.notify(p,'Make room in your backpack for the quest reward.');
      if(q.dropItem)p.inventory[q.dropItem]-=q.count;
      p.quests[q.id].status = 'complete'; if (p.trackedQuest === q.id) p.trackedQuest = null;
      p.gold += q.gold;
      const item = ITEMS[q.reward];
      if (item) {
        p.inventory[q.reward] = (p.inventory[q.reward] || 0) + q.rewardCount;
      }
      if(q.emoteReward&&!p.emotes.includes(q.emoteReward)){p.emotes.push(q.emoteReward);this.notify(p,`Learned /${q.emoteReward}: ${EMOTES[q.emoteReward].name}. Find it in Skills → Emotes.`,'good');}
      this.social.discover(p,q.reputationFaction||npcFaction(npc),q.reputationReward||35);
      this.gainXP(p, q.xp);
      this.notify(p, `${q.title} complete! +${q.xp} XP, ${q.gold} copper${item ? `, ${item.name}` : ''}.`, 'good');
      this.events.push({ type: 'questComplete', to: p.id, id: q.id });
    }
  }
  respawn(p) { const home=NPCS.find(n=>n.id===p.hearthNpcId&&n.role==='healer');Object.assign(p,home?{x:home.x,z:home.z}:ZONE.spawn);delete p.y; p.hp = stats(p).maxHp; p.energy = 100; p.auto = false; p.target = null; p.lastCombat = -100; p.input = { x: 0, z: 0 }; p.shield=0;p.shieldUntil=0;this.resetMotion(p); this.notify(p, 'The hearth calls you home. Your progress is safe.'); }
  hurt(p, damage, source, kind = 'enemy') {
    if (p.hp <= 0) return;
    let amount=Math.max(1,damage-stats(p).armor);if(p.shieldUntil>this.time&&p.shield>0){const absorbed=Math.min(amount,p.shield);p.shield-=absorbed;amount-=absorbed;}
    p.hp = Math.max(0, p.hp - amount); p.lastCombat = this.time;
    p.emote=null;this.effect(kind, source, p.id, amount);
    if(p.casting&&(p.casting.kind==='gather'||SKILLS[p.casting.skill]?.travel))this.cancelCast(p);
    if (!p.hp) { p.bankNpcId=null; p.deadAt = this.time; p.auto = false; p.input = { x: 0, z: 0 }; this.resetMotion(p); this.notify(p, 'Your light fades. Return to the hearth in 5 seconds.'); }
  }
  move(o, dx, dz) {
    if (walkable(o.x + dx, o.z)) o.x += dx;
    if (walkable(o.x, o.z + dz)) o.z += dz;
  }
  step(dt) {
    dt = Math.min(.1, Math.max(0, dt)); this.time += dt;
    for (const p of this.players.values()) {
      if(p.storageBusy)continue;
      if(this.travel.advance(p,dt))continue;
      if(p.mailboxId&&!this.correspondence?.access(p))p.mailboxId=null;
      if(p.bankNpcId&&!this.bankAccess(p))p.bankNpcId=null;
      if (p.hp <= 0) continue;
      if(p.sequenced){
        p.moveCredit=Math.min(MOVE_BUDGET,p.moveCredit+dt);
        while(p.moveQueue.length&&p.moveCredit+1e-9>=MOVE_STEP){
          const input=p.moveQueue.shift();if(p.casting&&input.seq>p.casting.startSeq&&(input.x||input.z||input.jump))this.cancelCast(p);
          advanceMotion(p,input);p.lastInputSeq=input.seq;p.moveCredit-=MOVE_STEP;
        }
        if(!p.moveQueue.length&&this.time-p.lastMoveAt>.3){advanceMotion(p,{x:0,z:0},dt);p.latestMove={x:0,z:0};}
      }else advanceMotion(p,this.time-p.inputAt<.3?p.input:{x:0,z:0},dt);
      p.mapId=zoneAt(p.x,p.z);this.travel.discover(p);
      if(p.casting&&this.time>=p.casting.endsAt)this.finishCast(p);
      p.energy = Math.min(100, p.energy + dt * 9);if(p.shieldUntil<=this.time)p.shield=0;
      if (this.time - p.lastCombat > 7) p.hp = Math.min(stats(p).maxHp, p.hp + dt * 7);
      for (const q of activeQuests(p)) if (q.kind === 'explore' && distance(p,q.location) < 4 && !questReady(p,q)) {
        questRecord(p,q).progress = q.count; this.notify(p, `${q.objective}: discovered.`, 'good');
      }
      const exit=ZONE_EXITS.find(e=>distance(p,e)<6);if(exit&&!exit.available&&this.time-(p.exitNoticeAt??-100)>20){p.exitNoticeAt=this.time;this.notify(p,`${exit.name}: ${exit.neighbor} is not open yet. This road is reserved for a neighboring zone.`);}
      const e = this.enemy(p.target);
      if (p.auto && !p.casting && e?.hp > 0 && !e.evading && distance(p, e) <= classDefinition(p.classId).autoRange && lineOfSight(p,e) && p.nextAttack <= this.time) {
        p.nextAttack = this.time + 1.8; this.hit(p, e, stats(p).power);
      }
    }
    this.routines.step(dt,new Set([...this.players.values()].flatMap(p=>interestAt(p.x,p.z).regions)));
    this.zones.refresh(this.players,this.npcs,this.enemies);
    const activeRegions=this.zones.activeRegions();
    this.social.step();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i], def = ENEMY_TYPES[e.type];
      if (e.hp <= 0) {
        if (this.time >= e.deadUntil) this.enemies[i] = this.spawn({ type: e.type, x: e.homeX, z: e.homeZ }, e.id);
        continue;
      }
      if(!e.target&&!activeRegions.has(regionAt(e.x,e.z)))continue;
      let target = this.players.get(e.target);
      if(target&&this.social.friendly(target,e)){e.target=null;target=null;e.slamAt=0;}
      if (target && (target.hp <= 0 || distance(e, { x: e.homeX, z: e.homeZ }) > 22 || distance(e, target) > 26)) {
        e.target = null; target = null; e.tags.clear(); e.hp = def.hp; e.slamAt = 0; e.evading = true;
      }
      if (e.evading) {
        const d = distance(e, {x:e.homeX,z:e.homeZ});
        if (d > .5) this.move(e,(e.homeX-e.x)/d*def.speed*1.5*dt,(e.homeZ-e.z)/d*def.speed*1.5*dt);
        else e.evading = false;
        continue;
      }
      if (!target && def.aggro) {
        target = [...this.players.values()].filter(p => p.hp > 0 && !this.social.friendly(p,e) && distance(e, p) < def.aggro&&lineOfSight(e,p)).sort((a,b) => distance(e,a) - distance(e,b))[0];
        if (target) e.target = target.id;
      }
      if (target) {
        e.roam=null;e.nextRoamAt=this.time+3;
        e.emote=null;target.lastCombat = this.time;
        const d = distance(e, target);
        e.facing = Math.atan2(target.x - e.x, target.z - e.z);
        if (!e.slamAt && d > 2.7) this.move(e, (target.x - e.x) / d * def.speed * (e.slowUntil>this.time?1-e.slow:1) * dt, (target.z - e.z) / d * def.speed * (e.slowUntil>this.time?1-e.slow:1) * dt);
        if (!e.slamAt && d <= 3.2 &&lineOfSight(e,target)&& e.nextAttack <= this.time) { e.nextAttack = this.time + 2; this.hurt(target, def.damage, e.id); }
        if (def.boss && this.time >= e.nextSlam && !e.slamAt) { e.slamAt = this.time + 1.8; e.nextSlam = this.time + 8; e.slamX=def.targetSlam?target.x:e.x;e.slamZ=def.targetSlam?target.z:e.z;this.notify(target,def.warning||'The Hollow Warden gathers its roots — leave the red circle!'); }
        if (e.slamAt && this.time >= e.slamAt) {
          for (const p of this.players.values()) if (p.hp > 0 && distance({x:e.slamX??e.x,z:e.slamZ??e.z}, p) < (def.slamRadius||7)) this.hurt(p, def.slamDamage||32, e.id, 'slam');
          this.effect('slam', e.id, e.id, 0); e.slamAt = 0;
        }
      } else {
        roamCreature(this,e,def,dt);
      }
    }
  }
  prepareSnapshots(){
    this.routines.step(0,new Set([...this.players.values()].flatMap(p=>interestAt(p.x,p.z).regions)));
    this.zones.refresh(this.players,this.npcs,this.enemies);
    return {zones:this.zones,players:new Map([...this.players.values()].map(v=>[v.id,{id:v.id,name:v.name,look:v.look,appearance:v.appearance,raceId:v.raceId,classId:v.classId,mapId:zoneAt(v.x,v.z),x:v.x,z:v.z,inTransit:!!v.transit,equipment:visibleEquipment(v.equipment),y:v.y,grounded:v.grounded,supportId:v.supportId,jumpHeight:v.jumpHeight,casting:v.casting?{skill:v.casting.skill,startedAt:v.casting.startedAt,endsAt:v.casting.endsAt}:null,emote:v.emote,facing:v.facing,hp:v.hp,maxHp:stats(v).maxHp,level:v.level}])),
      npcs:new Map(this.npcs.map(n=>[n.id,{id:n.id,name:n.name,title:n.title,mapId:zoneAt(n.x,n.z),role:n.role,services:n.services,facing:n.facing,emote:n.emote,x:n.x,z:n.z,y:n.y??heightAt(n.x,n.z),grounded:true,hp:n.hp,maxHp:n.maxHp,level:n.level,routineState:n.routineState}])),
      enemies:new Map(this.enemies.map(e=>[e.id,{id:e.id,type:e.type,x:e.x,z:e.z,emote:e.emote,factionId:ENEMY_TYPES[e.type].factionId,facing:e.facing,hp:e.hp,target:e.target,slamAt:e.slamAt,slamX:e.slamX,slamZ:e.slamZ,slamRadius:ENEMY_TYPES[e.type].slamRadius||7,evading:e.evading}]))};
  }
  snapshot(p,frame=this.prepareSnapshots()) {
    const {bank,...profile}=this.save(p),scope=interestAt(p.x,p.z),view=(actor,kind)=>({...frame[kind].get(actor.id),emote:distance(p,actor)<=SOCIAL_RANGE?actor.emote:null});
    return {
      type:'state',time:this.time,scope,
      self:{...profile,x:p.x,z:p.z,mapId:p.mapId,transit:this.travel.view(p),correspondence:this.correspondence?.summary(p)||{friends:[],unreadMail:0,mailbox:null},waypoint:waypointFor(p.waypointId),bank:this.bankView(p),...stats(p),y:p.y,grounded:p.grounded,supportId:p.supportId,jumpHeight:p.jumpHeight,jumpVelocity:p.jumpVelocity,motionEpoch:p.motionEpoch,lastInputSeq:p.lastInputSeq,casting:p.casting,shield:p.shield,shieldUntil:p.shieldUntil,globalCooldown:p.globalCooldown,lastCastRequest:p.lastCastRequest,target:p.target,targetSeq:p.targetSeq,autoSeq:p.autoSeq,auto:p.auto,cooldowns:p.cooldowns,respawnIn:p.hp<=0?Math.max(0,5-(this.time-p.deadAt)):0},
      npcs:frame.zones.actors(p,'npcs').map(n=>view(n,'npcs')),
      party:p.partyId?this.partySnapshot(p):null,partyInvite:this.inviteSnapshot(p),
      players:frame.zones.actors(p,'players').map(v=>view(v,'players')),
      enemies:frame.zones.actors(p,'enemies').map(e=>({...view(e,'enemies'),friendly:this.social.friendly(p,e),lootable:e.loot.has(p.id),questLoot:(e.lootContents.get(p.id)?.items||[]).filter(item=>item.questId).map(item=>item.questId)}))
    };
  }
}
