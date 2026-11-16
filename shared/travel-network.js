// Optional world-authored travel definitions preserve compatibility with packs
// that only implement a return hearth. Shared rules never trust client unlocks.
import * as authored from './travel.js';
export const TRAVEL_NODES=authored.TRAVEL_NODES||[];
export const FLIGHT_EDGES=authored.FLIGHT_EDGES||[];
export const travelNode=id=>TRAVEL_NODES.find(n=>n.id===id);
export function flightRoute(from,to,unlocked){
 const known=new Set(unlocked),queue=[from],previous=new Map([[from,null]]);
 if(!known.has(from)||!known.has(to))return null;
 for(let i=0;i<queue.length;i++)for(const edge of FLIGHT_EDGES){const next=edge.a===queue[i]?edge.b:edge.b===queue[i]?edge.a:null;if(!next||!known.has(next)||previous.has(next))continue;previous.set(next,queue[i]);queue.push(next);}
 if(!previous.has(to))return null;const nodes=[];for(let id=to;id;id=previous.get(id))nodes.unshift(id);
 const points=[];for(let i=1;i<nodes.length;i++){const edge=FLIGHT_EDGES.find(e=>e.a===nodes[i-1]&&e.b===nodes[i]||e.b===nodes[i-1]&&e.a===nodes[i]),segment=edge.a===nodes[i-1]?edge.points:[...edge.points].reverse();points.push(...(points.length?segment.slice(1):segment));}
 return points;
}
const nodeCells=new Map();
for(const node of TRAVEL_NODES){const key=`${Math.floor(node.x/128)}:${Math.floor(node.z/128)}`;if(!nodeCells.has(key))nodeCells.set(key,[]);nodeCells.get(key).push(node);}
export function nearbyTravelNodes(x,z){const result=[];for(let cx=Math.floor((x-14)/128);cx<=Math.floor((x+14)/128);cx++)for(let cz=Math.floor((z-14)/128);cz<=Math.floor((z+14)/128);cz++)result.push(...nodeCells.get(`${cx}:${cz}`)||[]);return result;}
