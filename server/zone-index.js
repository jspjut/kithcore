import {ZONE_REGIONS,regionAt,interestAt} from '../shared/zone-regions.js';
// A zone runtime owns maps of actors. A transition is a runtime of its own,
// never a second simulated copy of the same actor. Refresh runs once per frame.
export class ZoneIndex{
 constructor(){this.generation=0;this.occupied=new Set();this.regions=new Map(Object.keys(ZONE_REGIONS).map(id=>[id,{id,players:new Map(),npcs:new Map(),enemies:new Map()}]));}
 refresh(players,npcs,enemies){for(const r of this.occupied)for(const kind of ['players','npcs','enemies'])r[kind].clear();this.occupied.clear();for(const [kind,actors]of [['players',players.values()],['npcs',npcs],['enemies',enemies]])for(const actor of actors){const region=this.regions.get(regionAt(actor.x,actor.z));region[kind].set(actor.id,actor);this.occupied.add(region);}this.generation++;return this;}
 actors(observer,kind){return interestAt(observer.x,observer.z).regions.flatMap(id=>[...this.regions.get(id)[kind].values()]);}
 recipients(event,players){const scopes=event.regions||(Number.isFinite(event.x)&&Number.isFinite(event.z)?[regionAt(event.x,event.z)]:[]);return [...players.values()].filter(p=>interestAt(p.x,p.z).regions.some(id=>scopes.includes(id)));}
 activeRegions(){const active=new Set();for(const r of this.occupied)for(const p of r.players.values())for(const id of interestAt(p.x,p.z).regions)active.add(id);return active;}
 counts(){return Object.fromEntries([...this.regions].map(([id,r])=>[id,{players:r.players.size,npcs:r.npcs.size,enemies:r.enemies.size}]));}
}
