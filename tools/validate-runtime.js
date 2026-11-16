import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function validateRuntime(directory) {
  const from = file => import(pathToFileURL(path.join(directory,file)).href);
  const content=await from('shared/content.js');
  const {WORLD_INFO}=await from('shared/world-info.js');
  const {CLASSES,RACES,validRaceClass}=await from('shared/adventurers.js');
  const {World}=await from('server/world.js');
  const ui=await from('client/world-ui.js'),raceArt=await from('client/race-appearance.js');
  for(const name of ['trackerEmpty','npcGreeting','showQuestRing'])assert.equal(typeof ui[name],'function',`Missing world UI function ${name}`);
  assert.ok(ui.UI_CONFIG&&ui.raceTraits&&ui.classStories,'World UI configuration and identity descriptions are required');
  for(const name of ['racePalette','addRaceTraits'])assert.equal(typeof raceArt[name],'function',`Missing race presentation hook ${name}`);
  const {ZONE,ITEMS,SKILLS,NPCS,QUESTS,ENEMY_TYPES,ENEMY_SPAWNS,GATHERABLES,RESOURCE_TYPES,LEVEL_XP}=content;
  const check=(condition,message)=>assert.ok(condition,`${WORLD_INFO.id}: ${message}`);
  const unique=(values,label)=>{
    const ids=values.map(v=>v.id);
    check(ids.every(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]+$/.test(id)),`${label} require stable alphanumeric ids`);
    check(new Set(ids).size===ids.length,`${label} contain duplicate ids`);
  };
  check(ZONE&&Number.isInteger(ZONE.maxPlayers)&&ZONE.maxPlayers>0,'invalid player capacity');
  check(typeof ZONE.name==='string','zone name is required');
  check(content.walkable(ZONE.spawn.x,ZONE.spawn.z),'spawn must be inside walkable world geometry');
  check(LEVEL_XP.length>WORLD_INFO.levelCap,'XP table does not cover the declared level cap');
  for(let level=1;level<=WORLD_INFO.levelCap;level++)check(Number.isFinite(LEVEL_XP[level])&&(level===1||LEVEL_XP[level]>LEVEL_XP[level-1]),'XP thresholds must increase');
  for(const name of ['questForPlayer','questRecord','questReady','questAvailable','stats','levelForXP','canAddItem'])check(typeof content[name]==='function',`missing content rule ${name}`);
  check(Object.keys(CLASSES).length&&Object.keys(RACES).length,'at least one class and race are required');
  for(const c of Object.values(CLASSES)){
    check(ITEMS[c.starterWeapon]&&ITEMS[c.starterArmor],`missing starter items for ${c.id}`);
    check(c.skills.length>=6&&c.skills.every(id=>SKILLS[id]),`class ${c.id} needs six defined skill roles (plus optional extra abilities)`);
    check(Number.isFinite(c.health)&&Number.isFinite(c.healthPerLevel),'class health must be numeric');
  }
  for(const r of Object.values(RACES))check(r.classes.length&&r.classes.every(id=>validRaceClass(r.id,id)),`invalid classes for race ${r.id}`);
  unique(NPCS,'NPCs');unique(QUESTS,'quests');unique(GATHERABLES,'gatherables');
  const placed=[...NPCS,...ENEMY_SPAWNS,...GATHERABLES];
  for(const actor of placed)check(Number.isFinite(actor.x)&&Number.isFinite(actor.z),`invalid coordinates for ${actor.id||actor.type}`);
  for(const spawn of ENEMY_SPAWNS)check(ENEMY_TYPES[spawn.type],`unknown spawned enemy ${spawn.type}`);
  for(const [id,enemy]of Object.entries(ENEMY_TYPES)){
    check(enemy.hp>0&&enemy.speed>0&&Number.isFinite(enemy.damage)&&Number.isFinite(enemy.xp),`invalid combat stats for ${id}`);
    if(enemy.loot)check(ITEMS[enemy.loot],`unknown loot item for ${id}`);
  }
  for(const [id,resource]of Object.entries(RESOURCE_TYPES))check(ITEMS[resource.item]&&resource.respawn>0,`invalid resource ${id}`);
  for(const quest of QUESTS){
    check(NPCS.some(n=>n.id===quest.giver)&&NPCS.some(n=>n.id===quest.turnIn),`quest ${quest.id} has an unknown giver/recipient`);
    check(Array.isArray(quest.requires)&&quest.requires.every(id=>QUESTS.some(q=>q.id===id)),`quest ${quest.id} has unknown prerequisites`);
    check(quest.count>0&&Number.isInteger(quest.count)&&Number.isFinite(quest.xp)&&Number.isFinite(quest.gold)&&quest.rewardCount>0,`invalid rewards/objectives for ${quest.id}`);
    check(typeof quest.text==='string'&&typeof quest.objective==='string'&&typeof quest.complete==='string',`quest ${quest.id} is missing dialogue`);
    if(quest.reward)check(ITEMS[quest.reward],`unknown reward in ${quest.id}`);
    if(['kill','loot'].includes(quest.kind))check(ENEMY_TYPES[quest.target],`unknown enemy objective in ${quest.id}`);
    if(quest.kind==='gather')check(GATHERABLES.some(g=>g.type===quest.target),`missing gather objective for ${quest.id}`);
    if(quest.kind==='deliver')check(NPCS.some(n=>n.id===quest.target),`unknown delivery target in ${quest.id}`);
    if(quest.kind==='explore')check(Number.isFinite(quest.location?.x)&&Number.isFinite(quest.location?.z),`invalid exploration target in ${quest.id}`);
  }
  const world=new World(),player=world.addPlayer('Validation Guest');
  world.step(.1);
  check(world.save(player).worldId===WORLD_INFO.id,'saved character must carry world identity');
  check(world.snapshot(player).self.id===player.id,'simulation cannot construct a private snapshot');
  return {id:WORLD_INFO.id,version:WORLD_INFO.version,npcs:NPCS.length,quests:QUESTS.length,enemies:ENEMY_SPAWNS.length,items:Object.keys(ITEMS).length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await validateRuntime(process.argv[2]),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
