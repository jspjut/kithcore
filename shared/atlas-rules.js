export function createAtlasRules({ATLAS_MAPS,ATLAS_SIZE,STARTING_MAP,zoneAt}){
const atlasMap=id=>ATLAS_MAPS[id]?.charted?ATLAS_MAPS[id]:ATLAS_MAPS[STARTING_MAP];
const atlasChildren=id=>Object.values(ATLAS_MAPS).filter(map=>map.parent===id);
function atlasTrail(id){const trail=[];for(let map=atlasMap(id);map;map=map.parent?ATLAS_MAPS[map.parent]:null)trail.unshift(map);return trail;}
function containsPoint(polygon,x,y){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
function atlasHit(id,x,y){return atlasChildren(id).find(child=>child.charted&&(child.outlines||[child.outline]).some(p=>containsPoint(p,x,y)))||null;}
function projectAtlasLocation(id,location,zoneId=location?.mapId||zoneAt(location?.x,location?.z)){
  if(!location||!Number.isFinite(location.x)||!Number.isFinite(location.z))return null;
  let map=ATLAS_MAPS[zoneId];if(!map?.bounds||!map.charted)return null;
  const target=ATLAS_MAPS[id];if(target?.geographicProjection){let ancestor=map;while(ancestor&&ancestor.id!==id)ancestor=ancestor.parent?ATLAS_MAPS[ancestor.parent]:null;if(!ancestor)return null;const {bounds:b,frame:f}=target.geographicProjection;return {x:f.x+(location.x-b.minX)/(b.maxX-b.minX)*f.width,y:f.y+(location.z-b.minZ)/(b.maxZ-b.minZ)*f.height};}
  const b=map.bounds;let x=(location.x-b.minX)/(b.maxX-b.minX)*ATLAS_SIZE.width,y=(location.z-b.minZ)/(b.maxZ-b.minZ)*ATLAS_SIZE.height;
  while(map.id!==id){const r=map.placement;if(!map.parent||!r)return null;x=r.x+x/ATLAS_SIZE.width*r.width;y=r.y+y/ATLAS_SIZE.height*r.height;map=ATLAS_MAPS[map.parent];if(!map)return null;}
  return {x,y};
}

return {atlasMap,atlasChildren,atlasTrail,containsPoint,atlasHit,projectAtlasLocation};
}
