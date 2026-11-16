import {zoneAt,ZONE_BOUNDS} from './zone-layout.js';
import {createAtlasRules} from './atlas-rules.js';
import {REGIONS,TRAILS,HUBS} from './landscape.js';
export const ATLAS_SIZE={width:1000,height:720},STARTING_MAP='meadow';
const project=([x,z])=>[(x+80)/160*1000,(z+80)/160*720];
export const ATLAS_MAPS={
 'sample-world':{id:'sample-world',name:'Meadow Sample',kind:'World',parent:null,charted:true,subtitle:'Five corners of a small vale',survey:[[30,30],[970,30],[970,690],[30,690]],washes:[{x:500,y:360,rx:440,ry:300,color:'#9cac7b'}],labels:[{text:'MEADOW VALE',x:500,y:360,size:30}],unknown:[]},
 meadow:{id:'meadow',name:'Meadow Vale',kind:'Zone',parent:'sample-world',charted:true,placement:{x:80,y:60,width:840,height:600},outline:[[80,60],[920,60],[920,660],[80,660]],bounds:ZONE_BOUNDS,subtitle:'Five regions · three rest stops · levels 1–3',survey:[[20,20],[980,20],[980,700],[20,700]],
 washes:REGIONS.map(r=>{const [x,y]=project([r.x,r.z]);return {x,y,rx:160,ry:120,color:r.color};}),roads:TRAILS.map(t=>t.map(project)),settlements:HUBS.map(h=>{const [x,y]=project([h.x,h.z]);return {x,y,type:'village'};}),labels:REGIONS.map(r=>{const [x,y]=project([r.x,r.z]);return {text:r.name.toUpperCase(),x,y:y+45,size:18};}),unknown:[]}
};
export const WORLD_CONTENT_SLOTS=[];
export const {atlasMap,atlasChildren,atlasTrail,containsPoint,atlasHit,projectAtlasLocation}=createAtlasRules({ATLAS_MAPS,ATLAS_SIZE,STARTING_MAP,zoneAt});
