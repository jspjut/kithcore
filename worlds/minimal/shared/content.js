import {definition} from './definition.js';
import {createInventoryRules} from './inventory-rules.js';
import {createQuestRules} from './quest-rules.js';
import {classDefinition} from './adventurers.js';
import {groundWalkable} from './props.js';
import {WORLD_INFO} from './world-info.js';
export {EQUIPMENT_SLOTS,equipmentSlot,emptyEquipment} from './equipment-slots.js';
export {heightAt} from './terrain.js';
export const ZONE=definition.zone,LEVEL_XP=definition.levelXP,ITEMS=definition.items,SKILLS=definition.skills,NPCS=definition.npcs,QUESTS=definition.quests,ENEMY_TYPES=definition.enemyTypes,ENEMY_SPAWNS=definition.enemySpawns,GATHERABLES=definition.gatherables,RESOURCE_TYPES=definition.resourceTypes,MERCHANT_STOCK=definition.merchantStock,LANDMARKS=definition.landmarks,BUILDINGS=[];
export const BAG_CAPACITY=20,BAG_EQUIP_SLOTS=4,STACK_SIZE=99,GLOBAL_COOLDOWN=1.5;
export const {compatibleEquipmentSlots,canEquipInSlot,VISIBLE_EQUIPMENT_SLOTS,visibleEquipment,equippedItemCount,defaultEquipmentSlot,normalizeEquipment,equipmentBonuses,inventoryCapacity,storedItemCount,bagContainers,bagEntries,canAddItem}=createInventoryRules({ITEMS,BAG_CAPACITY,BAG_EQUIP_SLOTS,STACK_SIZE});
export const questForPlayer=(p,q)=>({...q,reward:rewardItemFor(p,q)});
export const rewardItemFor=(p,q)=>q.rewardsByClass?.[p.classId]||q.reward;
export const {questRecord,questDone,questReady,questAvailable,activeQuests,trackedQuest,npcQuests,dialogueQuests,questDestination}=createQuestRules({QUESTS,NPCS,questForPlayer,defaultClassId:'adventurer'});
export const walkable=(x,z)=>groundWalkable(x,z);
export function levelForXP(xp){let level=1;while(level<WORLD_INFO.levelCap&&xp>=LEVEL_XP[level+1])level++;return level;}
export function stats(p){const gear=equipmentBonuses(p),c=classDefinition(p.classId);return {maxHp:c.health+(p.level-1)*c.healthPerLevel+gear.vitality,power:5+(p.level-1)*2+gear.power,armor:gear.armor};}
