import {definition} from './definition.js';
export const CLASSES=definition.classes,RACES=definition.races,CLASS_SKILLS=definition.skills;
export const classDefinition=id=>CLASSES[id]||Object.values(CLASSES)[0];
export const raceDefinition=id=>RACES[id]||Object.values(RACES)[0];
export const validRaceClass=(race,id)=>!!RACES[race]&&!!CLASSES[id]&&RACES[race].classes.includes(id);
export function normalizeIdentity(value={}){const raceId=RACES[value.raceId]?value.raceId:Object.keys(RACES)[0],classId=validRaceClass(raceId,value.classId)?value.classId:RACES[raceId].classes[0];return {raceId,classId};}
export const classSkills=p=>classDefinition(p?.classId).skills;
export const skillForRole=(p,role)=>classSkills(p)[{primary:0,ranged:1,heal:2,area:3,utility:4,advanced:5}[role]];
export const armorAllowed=(id,type)=>!type||({cloth:['cloth'],leather:['cloth','leather'],mail:['cloth','leather','mail'],plate:['cloth','leather','mail','plate']})[classDefinition(id).armor].includes(type);
export const learnedSkill=(p,id)=>id==='recall'||classSkills(p).includes(id)&&p.level>=CLASS_SKILLS[id].level;
