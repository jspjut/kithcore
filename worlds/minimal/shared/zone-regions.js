import {REGIONS,landscapeAt} from './landscape.js';
export const ZONE_REGIONS=Object.fromEntries(REGIONS.map(r=>[r.id,{...r,kind:'region',neighbors:REGIONS.filter(n=>n!==r).map(n=>n.id)}]));
export const regionAt=(x,z)=>landscapeAt(x,z).id;
export const primaryZoneAt=()=> 'meadow';
// This small world intentionally shares interest across all five regions so
// chat, party actors and effects remain continuous at landscape boundaries.
export const interestAt=(x,z)=>({region:regionAt(x,z),primary:'meadow',regions:REGIONS.map(r=>r.id)});
export const interestedIn=()=>true;
export const ACTOR_FADE_START=60,ACTOR_VIEW_DISTANCE=75;
