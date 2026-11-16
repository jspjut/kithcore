// Build-only staging in a disposable runtime. Never loaded by the production entry.
// Combat, loot, NPC speeches and emotes still use the real authoritative systems.
import {ZONE,LEVEL_XP,ENEMY_SPAWNS,walkable,heightAt} from '../shared/content.js';
import {lineOfSight} from '../shared/props.js';
export function installDemo(world,kind){
 const at=(x,z)=>({x,z,y:heightAt(x,z)});let anchor;
 for(const dx of [-14,14,0,-24,24])for(const dz of [0,10,-10]){
  if(anchor)break;const x=ZONE.spawn.x+dx,z=ZONE.spawn.z+dz;
  const points=kind==='combat'?Array.from({length:12},(_,i)=>at(x,z-i)):[at(x-3.2,z),at(x+3.2,z),at(x,z+8)];
  if(points.every(p=>walkable(p.x,p.z))&&points.every(p=>points.every(q=>lineOfSight(p,q))))anchor={x,z};
 }
 if(!anchor)throw Error('No clear demo staging area in this world');
 world.social.ambient.globalReady=Infinity;
 if(kind==='combat')world.enemies=[{...world.spawn({...ENEMY_SPAWNS[0],x:anchor.x,z:anchor.z-10},'demo-mob'),nextRoamAt:Infinity}];
 else{
  world.enemies=[];world.npcs=world.npcs.slice(0,2);if(world.npcs.length<2)throw Error('Social demo requires two NPCs');
  world.npcs.forEach((n,i)=>{n.x=anchor.x+(i===0?-3.2:3.2);n.z=anchor.z;n.y=heightAt(n.x,n.z);delete n.routineId;n.homeFacing=n.facing=i===0?Math.PI/2:-Math.PI/2;n.faceUntil=Infinity;});
 }
 let joinedAt=null,cue=0;const add=world.addPlayer.bind(world),step=world.step.bind(world);
 world.addPlayer=(name,saved)=>{const player=add(name,{...saved,x:anchor.x,z:anchor.z+(kind==='social'?8:0),xp:LEVEL_XP[3]||0,hp:100000});joinedAt=world.time;return player;};
 const lines=[
  {at:1.4,who:0,emote:'wave',text:'New faces on the road.'},
  {at:4.2,who:1,emote:'nod',text:'Then let us make them welcome.'},
  {at:7.2,who:0,emote:'laugh',text:'Shall we check the post together?'},
  {at:10.2,who:1,emote:'bow',text:'A letter can start an adventure.'}
 ];
 world.step=dt=>{step(dt);if(kind!=='social'||joinedAt===null)return;while(cue<lines.length&&world.time-joinedAt>=lines[cue].at){const line=lines[cue++],speaker=world.npcs[line.who],other=world.npcs[1-line.who];speaker.facing=Math.atan2(other.x-speaker.x,other.z-speaker.z);speaker.faceUntil=world.time+20;world.social.play(speaker,line.emote,other,line.text,{ambient:true,cause:'showcase-conversation'});}};
}
