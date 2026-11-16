import {definition} from './definition.js';
import {heightAt} from './terrain.js';
import {withinZone} from './zone-layout.js';
import {createCollisionWorld} from './collision.js';
export {CHARACTER_HEIGHT,STEP_HEIGHT,SUPPORT_RADIUS} from './collision.js';
export const WORLD_COLLIDERS=definition.colliders;
export const {nearbyColliders,overlaps,colliderTop,supportBelow,bodyFits,groundWalkable,settleOnSurface,lineOfSight}=createCollisionWorld({WORLD_COLLIDERS,heightAt,withinZone});
