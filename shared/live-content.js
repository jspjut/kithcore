import {zoneAt} from './zone-layout.js';
// Data-only updates shared by the authoritative simulation and browser.
// Registries retain their identity so existing rule closures see new entries.
import {ITEMS,SKILLS,NPCS,QUESTS,ENEMY_TYPES,ENEMY_SPAWNS,MERCHANT_STOCK,GATHERABLES,ZONE,walkable} from './content.js';
import {CLASSES,CLASS_SKILLS} from './adventurers.js';
import {WORLD_INFO} from './world-info.js';

export const LIVE_CONTENT={revision:0,patches:[]};
export const LIVE_DIALOGUE={};
const clone=value=>structuredClone(value);
const fail=message=>{throw Error(message);};
const object=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);return value;};
const fields=(value,allowed,label)=>{object(value,label);for(const key of Object.keys(value))if(!allowed.includes(key))fail(`Unsupported ${label} field: ${key}; use a maintenance update`);};
const list=(value,label)=>{if(!Array.isArray(value)||value.length>256)fail(`${label} must be an array of at most 256 entries`);return value;};
const id=value=>{if(typeof value!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value)||['constructor','prototype','__proto__'].includes(value))fail(`Invalid content id: ${value}`);return value;};
const text=(value,label,max=2000)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[<>\u0000-\u0008]/.test(value))fail(`${label} must be plain text (maximum ${max} characters)`);};
const number=(value,label,min=0,max=1000000)=>{if(!Number.isFinite(value)||value<min||value>max)fail(`Invalid ${label}`);};
const numeric=(value,keys)=>{for(const key of keys)if(value[key]!==undefined)number(value[key],key);};
const strings=(value,keys)=>{for(const key of keys)if(value[key]!==undefined)text(value[key],key);};
function safeTree(value){if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail('Unsafe object key');safeTree(v);}}
function position(value){number(value.x,'x',ZONE.bounds?.minX??-ZONE.radius,ZONE.bounds?.maxX??ZONE.radius);number(value.z,'z',ZONE.bounds?.minZ??-ZONE.radius,ZONE.bounds?.maxZ??ZONE.radius);if(!walkable(value.x,value.z))fail('Placement is outside walkable geometry');}
const own=(map,key)=>Object.hasOwn(map,key);

// Validate everything against a candidate copy before changing any live state.
export function prepareLivePatch(input){
 if(JSON.stringify(input).length>128*1024)fail('Update exceeds 128 KiB');safeTree(input);
 fields(input,['id','worldId','items','abilities','enemyTypes','npcs','spawns','quests','dialogue','questText','merchantStock','announcements'],'update');
 id(input.id);if(input.worldId!==WORLD_INFO.id)fail('Update belongs to another world');if(LIVE_CONTENT.patches.some(p=>p.id===input.id))fail('Update id already exists');
 const patch=clone(input),items=clone(ITEMS),skills=clone(SKILLS),enemies=clone(ENEMY_TYPES),npcs=clone(NPCS),quests=clone(QUESTS);
 const additions={items:{},abilities:{},enemyTypes:{},npcs:[],spawns:[],quests:[]};
 function templates(section,registry,allowed,check){
  for(const [key,entry]of Object.entries(object(patch[section]||{},section))){
   id(key);if(section==='items'&&own(SKILLS,key)||section==='abilities'&&own(items,key))fail('Item and ability ids must not collide');if(own(registry,key))fail(`${section} ${key} already exists; existing definitions cannot be replaced live`);
   fields(entry,['template','values'],section);id(entry.template);if(!own(registry,entry.template))fail(`Unknown ${section} template: ${entry.template}`);
   fields(entry.values||{},allowed,section);const value={...clone(registry[entry.template]),...entry.values};check(value,key,entry.template);registry[key]=value;additions[section][key]=value;
  }
 }
 templates('items',items,['name','description','icon','quality','power','armor','vitality','price','sell','minLevel','bagSlots'],(v,key,template)=>{
  v.iconId=v.iconId||template;
  strings(v,['name','description','icon']);numeric(v,['power','armor','vitality','price','sell','minLevel','bagSlots']);if(v.bagSlots!==undefined&&(!Number.isInteger(v.bagSlots)||v.bagSlots>64))fail('bagSlots must be an integer up to 64');if(!['common','uncommon','rare','epic','legendary'].includes(v.quality))fail('Invalid item quality');
 });
 templates('abilities',skills,['name','description','level','cost','cooldown','range','damage','heal','shield','castTime','radius','chain','slow'],(v,key,template)=>{
  if(!own(CLASSES,v.classId)||!CLASSES[v.classId].skills.includes(template)||v.travel)fail('Ability template must be an existing class ability');
  strings(v,['name','description']);numeric(v,['cost','cooldown','range','damage','heal','shield','castTime','radius','chain']);number(v.level,'ability level',1,WORLD_INFO.levelCap);if(!Number.isInteger(v.level))fail('Ability level must be an integer');if(v.slow!==undefined)number(v.slow,'slow',0,1);if(v.chain!==undefined&&(!Number.isInteger(v.chain)||v.chain>20))fail('chain must be an integer up to 20');
  v.key='';v.iconId=v.iconId||template;
 });
 templates('enemyTypes',enemies,['name','hp','damage','speed','xp','gold','loot','lootChance','respawn','level','aggro','color'],(v,key,template)=>{
  strings(v,['name']);numeric(v,['damage','xp','gold','aggro','respawn']);number(v.hp,'enemy hp',1);number(v.speed,'enemy speed',.01,100);number(v.level,'enemy level',1,100);if(v.loot&&!own(items,v.loot))fail('Unknown enemy loot');if(v.lootChance!==undefined)number(v.lootChance,'lootChance',0,1);if(v.color!==undefined)number(v.color,'color',0,0xffffff);v.appearanceType=v.appearanceType||template;
 });
 const actorIds=new Set([...NPCS,...GATHERABLES].map(v=>v.id));ENEMY_SPAWNS.forEach((s,i)=>actorIds.add(s.id||`mob-${i}`));
 for(const entry of list(patch.npcs||[],'npcs')){
  fields(entry,['id','template','x','z','values'],'npc');id(entry.id);if(actorIds.has(entry.id)||entry.id.startsWith('live-mob-'))fail('Duplicate/reserved NPC id');actorIds.add(entry.id);
  const template=npcs.find(n=>n.id===entry.template);if(!template)fail('Unknown NPC template');fields(entry.values||{},['name','title','color','facing','lore'],'npc values');strings(entry.values||{},['name','title','lore']);if(entry.values?.color!==undefined)number(entry.values.color,'NPC color',0,0xffffff);if(entry.values?.facing!==undefined)number(entry.values.facing,'facing',-Math.PI*2,Math.PI*2);position(entry);
  const value={...clone(template),...entry.values,id:entry.id,x:entry.x,z:entry.z,mapId:zoneAt(entry.x,entry.z)};delete value.routineId;delete value.phaseDelay;delete value.topics;delete value.greeting;delete value.storyId;value.services=(value.services||[]).filter(s=>!['waypoint','inn'].includes(s));
  npcs.push(value);additions.npcs.push(value);
 }
 for(const entry of list(patch.spawns||[],'spawns')){
  fields(entry,['id','type','x','z'],'spawn');id(entry.id);const runtimeId=`live-mob-${entry.id}`;if(actorIds.has(runtimeId))fail('Duplicate spawn id');actorIds.add(runtimeId);if(!own(enemies,entry.type))fail('Unknown spawned enemy');position(entry);additions.spawns.push({...entry,id:runtimeId});
 }
 for(const q of list(patch.quests||[],'quests')){
  fields(q,['id','title','objective','text','complete','giver','turnIn','kind','target','count','xp','gold','reward','rewardCount','rewardsByClass','requires','minLevel','classId','location','dropItem'],'quest');id(q.id);if(quests.some(v=>v.id===q.id))fail('Quest already exists; use questText for dialogue changes');
  const value={count:1,xp:0,gold:0,rewardCount:1,minLevel:1,requires:[],...q};strings(value,['title','objective','text','complete']);for(const key of ['title','objective','text','complete'])if(!value[key])fail(`Quest ${key} is required`);
  for(const key of ['giver','turnIn'])if(!npcs.some(n=>n.id===value[key]))fail('Unknown quest NPC');
  numeric(value,['xp','gold']);for(const key of ['count','rewardCount','minLevel']){number(value[key],key,1);if(!Number.isInteger(value[key]))fail(`${key} must be an integer`);}if(value.minLevel>WORLD_INFO.levelCap)fail('Quest exceeds current level cap');
  if(value.classId&&!own(CLASSES,value.classId))fail('Unknown quest class');if(value.reward&&!own(items,value.reward))fail('Unknown quest reward');
  for(const [classId,reward]of Object.entries(object(value.rewardsByClass||{},'class rewards')))if(!own(CLASSES,classId)||!own(items,reward))fail('Unknown class reward');
  if(['kill','loot'].includes(value.kind)){if(!own(enemies,value.target))fail('Unknown quest enemy');if(value.kind==='loot'&&!own(items,value.dropItem))fail('Unknown quest drop item');}
  else if(value.kind==='gather'){if(!GATHERABLES.some(g=>g.type===value.target))fail('Unknown gathering target');}
  else if(value.kind==='skill'){if(!own(skills,value.target))fail('Unknown quest ability');}
  else if(value.kind==='explore'){fields(value.location,['x','z'],'quest location');position(value.location);}
  else fail('Unsupported quest kind');
  list(value.requires,'quest prerequisites').forEach(id);quests.push(value);additions.quests.push(value);
 }
 const visited=new Set(),visiting=new Set();function visit(q){if(visited.has(q.id))return;if(visiting.has(q.id))fail('Quest prerequisite cycle');visiting.add(q.id);for(const dep of q.requires||[]){const next=quests.find(v=>v.id===dep);if(!next)fail('Unknown quest prerequisite');visit(next);}visiting.delete(q.id);visited.add(q.id);}additions.quests.forEach(visit);
 for(const [key,value]of Object.entries(object(patch.dialogue||{},'dialogue'))){if(!npcs.some(n=>n.id===key))fail('Unknown dialogue NPC');fields(value,['greeting','reply'],'dialogue');strings(value,['greeting','reply']);}
 for(const [key,value]of Object.entries(object(patch.questText||{},'questText'))){if(!quests.some(q=>q.id===key))fail('Unknown quest text id');fields(value,['title','objective','text','complete'],'questText');strings(value,['title','objective','text','complete']);}
 if(patch.merchantStock!==undefined){list(patch.merchantStock,'merchantStock');if(new Set(patch.merchantStock).size!==patch.merchantStock.length)fail('Duplicate merchant stock');for(const key of patch.merchantStock)if(!own(items,key)||!Number.isFinite(items[key].price)||items[key].price<0)fail('Stock requires an existing priced item');}
 list(patch.announcements||[],'announcements').forEach(t=>text(t,'announcement',500));
 if(Object.keys(items).length+Object.keys(skills).length+Object.keys(enemies).length+npcs.length+quests.length+ENEMY_SPAWNS.length+additions.spawns.length>20000)fail('Live content registry limit exceeded');
 return {patch,additions};
}

export function commitLivePatch(plan){
 const {patch,additions:a}=plan;
 Object.assign(ITEMS,a.items);Object.assign(SKILLS,a.abilities);Object.assign(CLASS_SKILLS,a.abilities);Object.assign(ENEMY_TYPES,a.enemyTypes);
 for(const [key,value]of Object.entries(a.abilities))CLASSES[value.classId].skills.push(key);
 NPCS.push(...a.npcs);ENEMY_SPAWNS.push(...a.spawns);QUESTS.push(...a.quests);
 for(const [key,value]of Object.entries(patch.dialogue||{}))LIVE_DIALOGUE[key]={...LIVE_DIALOGUE[key],...value};
 for(const [key,value]of Object.entries(patch.questText||{}))Object.assign(QUESTS.find(q=>q.id===key),value);
 if(patch.merchantStock!==undefined)MERCHANT_STOCK.splice(0,MERCHANT_STOCK.length,...patch.merchantStock);
 LIVE_CONTENT.patches.push(patch);LIVE_CONTENT.revision++;
 return a;
}
export function applyLiveSnapshot(snapshot){
 if(!snapshot||!Number.isInteger(snapshot.revision)||snapshot.revision!==snapshot.patches?.length||snapshot.revision<LIVE_CONTENT.revision)fail('Inconsistent live content snapshot; reload required');
 for(let i=0;i<LIVE_CONTENT.revision;i++)if(JSON.stringify(snapshot.patches[i])!==JSON.stringify(LIVE_CONTENT.patches[i]))fail('Live content history changed; reload required');
 for(const patch of snapshot.patches.slice(LIVE_CONTENT.revision))commitLivePatch(prepareLivePatch(patch));
}
