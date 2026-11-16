import {definition} from './definition.js';
export const RECALL_COOLDOWN=900,RECALL_SKILL=definition.skills.recall;
export const WAYPOINTS=[
 {id:'meadow-home',name:'Meadow camp',mapId:'meadow',x:0,z:12,npcId:'guide',default:true,available:true},
 {id:'willow-rest',name:'Willow rest',mapId:'meadow',x:-44,z:-5,npcId:'herbalist',available:true},
 {id:'ridgewatch',name:'Ridgewatch camp',mapId:'meadow',x:28,z:-42,npcId:'warden',available:true}
];
export const waypointFor=id=>WAYPOINTS.find(p=>p.id===id)||WAYPOINTS[0];
