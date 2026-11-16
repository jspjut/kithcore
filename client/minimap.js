import {TRAVEL_NODES} from '../shared/travel-network.js';
import {MAILBOXES} from '../shared/mail.js';
import {WAYPOINTS} from '../shared/travel.js';
import {ZONE_EXITS} from '../shared/zone-layout.js';
import {SKILLS,ENEMY_TYPES} from '../shared/content.js';
import { QUESTS, NPCS, GATHERABLES, ENEMY_SPAWNS, RESOURCE_TYPES, activeQuests, questRecord, questReady, npcQuests, trackedQuest } from '../shared/content.js';

export const TRACKING_OPTIONS = [
  ['objectives','Quest objectives',true],['questGivers','Quest givers',true],['inns','Inns & rest points',true],['trainers','Trainers & mentors',true],['merchants','Merchants',true],['banks','Banks',true],['mailboxes','Mailboxes',true],
  ['herbs','Herb nodes',false],['mining','Ore nodes',false],['waypoints','Return waypoints',true],['flights','Flight stones & capitals',true],['roads','Roads to future zones',true],['objects','Other objects',false],['enemies','Enemies',true]
];
export const OBJECTIVE_OPTIONS=[['hunt','Hunting & loot',true],['gathering','Gathering',true],['exploration','Exploration',true],['delivery','Deliveries & conversations',true],['training','Class practice',true],['social','Emotes & connections',true],['turnIns','Ready to turn in',true]];
export function objectiveCategory(q,ready){return ready?'turnIns':({kill:'hunt',loot:'hunt',gather:'gathering',explore:'exploration',deliver:'delivery',skill:'training',emote:'social'})[q.kind];}
export function questTooltip(quests,pin=true){
  const shown=[...quests].sort((a,b)=>Number(b.selected)-Number(a.selected)).slice(0,5),more=quests.length-shown.length;
  return {title:quests.length===1?quests[0].title:'Quest objectives',detail:shown.map(q=>`${q.number}. ${q.title}\n${q.objective} · ${q.progress}/${q.count}`).join('\n\n')+(more?`\n\n${more} more quests here; see your quest log.`:'')+(pin?'\n\nClick to track; click again to cycle.':'\n\nClick to open the world map.')};
}
export function trackingSettings(saved={}){return Object.fromEntries([...TRACKING_OPTIONS,...OBJECTIVE_OPTIONS].map(([id,,fallback])=>[id,typeof saved?.[id]==='boolean'?saved[id]:fallback]));}
const near=(p,list)=>[...list].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
export function questOverlays(p,enemies=[],settings=null){
  if(!p||settings?.objectives===false)return [];
  const selected=trackedQuest(p);
  return activeQuests(p).map((q,index)=>{
    const record=questRecord(p,q),ready=questReady(p,q);let points=[],targets=[],instruction=q.objective;
    if(ready){points=targets=[NPCS.find(n=>n.id===q.turnIn)];instruction=`Return to ${targets[0].name}`;}
    else if(q.kind==='deliver'){points=targets=[NPCS.find(n=>n.id===q.target)];instruction=`Speak to ${targets[0].name}`;}
    else if(q.kind==='emote'){const npc=NPCS.find(n=>n.id===q.emoteTarget);points=npc?[npc]:ENEMY_SPAWNS.filter(e=>e.type===q.emoteTarget);targets=npc?[npc]:enemies.filter(e=>e.type===q.emoteTarget&&e.hp===ENEMY_TYPES[e.type]?.hp&&!e.target&&!e.evading);instruction=q.objective;}
    else if(q.kind==='gather'){
      points=GATHERABLES.filter(g=>g.type===q.target&&!record.gathered.includes(g.id));targets=points.filter(g=>!(p.harvestCooldowns?.[g.id]>0));
      if(!targets.length&&points.length)instruction='Wait for the resources to recover';
    }else if(q.kind==='kill'||q.kind==='loot'||q.kind==='skill'&&!SKILLS[q.target]?.heal&&!SKILLS[q.target]?.shield){
      const type=q.kind==='skill'?(q.practiceEnemy||(q.minLevel>=7?'ashconstruct':SKILLS[q.target]?.level===1?'nibbler':'shardling')):q.target;
      points=ENEMY_SPAWNS.filter(e=>e.type===type);targets=enemies.filter(e=>e.type===type&&e.hp>0&&!e.evading);
      const corpses=q.kind==='loot'?enemies.filter(e=>e.hp<=0&&e.lootable&&e.questLoot?.includes(q.id)):[];
      if(corpses.length){targets=corpses;instruction='Loot the marked remains';}
    }else if(q.kind==='skill'&&(SKILLS[q.target]?.heal||SKILLS[q.target]?.shield)){points=targets=[{x:p.x,z:p.z,self:true}];instruction=`Practice ${SKILLS[q.target].name}`;}
    else points=targets=q.location?[q.location]:[];
    const target=near(p,targets.length?targets:points)[0]||q.location||NPCS.find(n=>n.id===q.giver);
    const areaPoints=points.length?points:[target],x=areaPoints.reduce((n,v)=>n+v.x,0)/areaPoints.length,z=areaPoints.reduce((n,v)=>n+v.z,0)/areaPoints.length;
    const radius=Math.max(3,...areaPoints.map(v=>Math.hypot(v.x-x,v.z-z)+4));
    return {id:q.id,number:index+1,title:q.title,objective:instruction,progress:record.progress,count:q.count,ready,category:objectiveCategory(q,ready),selected:selected?.id===q.id,target,points:areaPoints,area:{x,z,radius},distance:Math.hypot(target.x-p.x,target.z-p.z)};
  }).filter(q=>settings?.[q.category]!==false);
}
export function trackingMarkers(p,settings,live=null){
  if(!p)return [];const filters=trackingSettings(settings),markers=[];
  const current=new Map((live||[]).map(n=>[n.id,n])),npcs=live?NPCS.filter(n=>!n.routineId||current.has(n.id)).map(n=>({...n,...current.get(n.id)})):NPCS;
  for(const npc of npcs){
    const quests=filters.questGivers?npcQuests(p,npc.id):[];
    const services=(npc.services||[]).filter(s=>s==='inn'?filters.inns:s==='trainer'?filters.trainers:s==='merchant'?filters.merchants:s==='bank'?filters.banks:false);
    if(!quests.length&&!services.length)continue;
    markers.push({id:`npc:${npc.id}`,npcId:npc.id,x:npc.x,z:npc.z,kind:'npc',glyph:quests.some(q=>questReady(p,q))?'?':quests.length?'!':services.includes('inn')?'⌂':services.includes('trainer')?'T':services.includes('bank')?'B':'$',title:npc.name,detail:[...quests.map(q=>`${questReady(p,q)?'Ready':'Available'}: ${q.title}`),...services.map(s=>({inn:'Inn / rest & recovery',trainer:'Class mentor',merchant:'Provisions & bags',bank:'Bank · store and withdraw items'})[s])].join('\n'),quests:quests.map(q=>q.id)});
  }
  if(filters.mailboxes)for(const box of MAILBOXES)markers.push({id:box.id,x:box.x,z:box.z,kind:'mailbox',glyph:'✉',title:box.name,detail:'Mailbox · Send letters and items to online or offline adventurers.'});
  if(filters.waypoints)for(const point of WAYPOINTS.filter(v=>v.available))markers.push({id:`waypoint:${point.id}`,x:point.x,z:point.z,kind:'waypoint',glyph:'⌂',title:point.name,detail:`${p.waypointId===point.id?'Your bound return waypoint.':point.default?'Default return point.':point.selfService?'Stand beside the inn hearth and open Travel to bind your return.':`Speak to ${NPCS.find(n=>n.id===point.npcId)?.name||'the innkeeper'} to bind your return.`} Hearthward Return: 15-minute cooldown.`});
  if(filters.flights)for(const node of TRAVEL_NODES)markers.push({id:`travel:${node.id}`,x:node.x,z:node.z,kind:node.kind==='capital'?'capital':'flight',glyph:node.kind==='capital'?'♜':'↟',title:node.name,detail:node.kind==='capital'?'Capital city · Flight stone and portal. Visit on foot to unlock.':`${p.travelUnlocks?.includes(node.id)?'Discovered flight stone.':'Visit on foot to discover this flight stone.'} Open Travel to depart.`});
  if(filters.roads)for(const exit of ZONE_EXITS)markers.push({id:`road:${exit.id}`,x:exit.x,z:exit.z,kind:'road',glyph:'↗',title:exit.name,detail:`${exit.neighbor} · ${exit.kind}. ${exit.description} ${exit.available?'This city is open along the road.':'This neighboring zone is not open yet.'}`});
  for(const g of GATHERABLES){
    const resource=RESOURCE_TYPES[g.type];if(resource){if(!filters[resource.tracking]||p.harvestCooldowns?.[g.id]>0)continue;}
    else if(!filters.objects||Object.values(p.quests||{}).some(q=>q.gathered.includes(g.id)))continue;
    markers.push({id:`object:${g.id}`,x:g.x,z:g.z,kind:resource?.tracking||'object',title:resource?.name||({cache:'Abandoned supplies',beacon:'Ancient beacon',track:'Root trace',ledger:'Courier’s journal',sap:'Amber sapling',page:'Memorial tablet'})[g.type]||'Object',detail:resource?'Approach and press F to gather.':'May be needed for a local quest.'});
  }
  return markers;
}

export const MAP_RADII = [12, 18, 26, 38, 55, 76];
export const DEFAULT_MAP_ZOOM = 2;
export function clampZoom(index) { return Number.isFinite(index)?Math.max(0,Math.min(MAP_RADII.length-1,Math.round(index))):DEFAULT_MAP_ZOOM; }
export function mapView(width,height,player,zoom=DEFAULT_MAP_ZOOM,large=false) {
  const radius=large?72.5:MAP_RADII[clampZoom(zoom)];
  const center=large?{x:0,z:0}:player||{x:0,z:0};
  return {centerX:center.x,centerZ:center.z,radius,scale:Math.min(width,height)/(radius*2),width,height};
}
export function mapPoint(view,x,z) { return [view.width/2+(x-view.centerX)*view.scale,view.height/2+(z-view.centerZ)*view.scale]; }
export function edgePoint(view,x,z,padding=10) {
  const [px,py]=mapPoint(view,x,z),dx=px-view.width/2,dy=py-view.height/2;
  const factor=Math.min(1,(view.width/2-padding)/Math.max(.001,Math.abs(dx)),(view.height/2-padding)/Math.max(.001,Math.abs(dy)));
  return {x:view.width/2+dx*factor,y:view.height/2+dy*factor,outside:factor<1,angle:Math.atan2(dy,dx)};
}
