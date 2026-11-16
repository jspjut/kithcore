import {activeQuests,NPCS} from '../shared/content.js';
import {ATLAS_MAPS,STARTING_MAP,projectAtlasLocation} from '../shared/atlas.js';
import {questTooltip} from './minimap.js';
export function questsByZone(player){const zones=new Map();for(const q of activeQuests(player)){const id=q.mapId||NPCS.find(n=>n.id===q.giver)?.mapId||STARTING_MAP;if(!zones.has(id))zones.set(id,[]);zones.get(id).push(q);}return zones;}
export function atlasQuestIndicators(mapId,player){
 if(!player||ATLAS_MAPS[mapId]?.bounds)return [];
 const indicators=[];
 for(const [id,quests]of questsByZone(player)){const zone=ATLAS_MAPS[id];if(!zone?.bounds||!zone.charted)continue;const b=zone.bounds,point=projectAtlasLocation(mapId,{x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2},id);if(!point)continue;
  let child=zone;while(child.parent&&child.parent!==mapId)child=ATLAS_MAPS[child.parent];if(child.parent!==mapId)continue;
  indicators.push({...point,kind:'zoneQuests',zoneId:id,navigate:child.id,count:quests.length,quests,title:`${zone.name} · ${quests.length} current ${quests.length===1?'quest':'quests'}`,detail:quests.map(q=>q.title).join('\n')+'\n\nClick to open this region.'});
 }return indicators;
}
export function hitAtlasQuest(hits,x,y){
 const under=hits.filter(h=>((x-h.x)/(h.rx||1))**2+((y-h.y)/(h.ry||1))**2<=1),pin=under.find(h=>h.kind==='quest'||h.kind==='zoneQuests');
 if(pin?.kind==='zoneQuests')return pin;
 const matches=pin?[pin]:under.filter(h=>h.kind==='questArea');if(!matches.length)return null;
 const quests=[...new Map(matches.flatMap(h=>h.quests).map(q=>[q.id,q])).values()];return {kind:pin?'quest':'questArea',quests:quests.map(q=>q.id),...questTooltip(quests,true)};
}
