import {definition} from './definition.js';
export const LAYOUT_REVISION=definition.zone.layoutRevision,SPAWN=definition.zone.spawn,ZONE_BOUNDS=definition.zone.bounds,WORLD_BOUNDS=ZONE_BOUNDS,ZONE_EXITS=[];
export const zoneAt=()=> 'meadow';
export const withinZone=(x,z,margin=0)=>Number.isFinite(x)&&Number.isFinite(z)&&x>ZONE_BOUNDS.minX+margin&&x<ZONE_BOUNDS.maxX-margin&&z>ZONE_BOUNDS.minZ+margin&&z<ZONE_BOUNDS.maxZ-margin;
export const migratePosition=p=>withinZone(p.x,p.z)?{x:p.x,z:p.z}:{...SPAWN};
