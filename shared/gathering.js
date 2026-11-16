import {RESOURCE_TYPES,activeQuests,questRecord,questReady} from './content.js';
export const GATHER_CAST_TIME=1;
export function gatherAvailable(player,object,time=0){
 if(!player||player.hp<=0||!object)return false;
 if(RESOURCE_TYPES[object.type])return player.harvestReady?((player.harvestReady[object.id]||0)<=time):!((player.harvestCooldowns?.[object.id]||0)>0);
 return activeQuests(player).some(q=>q.kind==='gather'&&q.target===object.type&&!questReady(player,q)&&!questRecord(player,q).gathered.includes(object.id));
}
export const gatherLabel=object=>({cache:'Collecting supplies',ledger:'Collecting journal',sap:'Gathering amber',herb:'Gathering sunmint',ore:'Mining copper',beacon:'Rekindling beacon',track:'Examining root trace',page:'Reading memorial tablet',orchard:'Inspecting harvest'}[object.type]||`Collecting ${object.name||'quest object'}`);
