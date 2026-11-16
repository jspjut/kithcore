import test from 'node:test';
import assert from 'node:assert/strict';
import {RACES,CLASSES,skillForRole,validRaceClass} from '../shared/adventurers.js';
import {World} from '../server/world.js';
import {QUESTS,NPCS,GATHERABLES,questReady,questRecord,stats} from '../shared/content.js';
import {settleOnSurface} from '../shared/props.js';
import {advanceMotion} from '../shared/movement.js';

for(const raceId of Object.keys(RACES))for(const classId of Object.keys(CLASSES))test(`${raceId}/${classId}: complete the sample campaign and restore identity and class rewards`,()=>{
  assert.ok(validRaceClass(raceId,classId));
  const w=new World(),p=w.addPlayer('Example Guest',{raceId,classId});
  const run=seconds=>{for(let i=0;i<seconds/.05;i++)w.step(.05);};
  const at=point=>{p.x=point.x;p.z=point.z;delete p.y;settleOnSurface(p);p.input={x:0,z:0};};
  const guide=NPCS.find(n=>n.id==='guide');at(guide);w.command(p,{type:'quest',action:'accept',id:'first_steps'});
  // Walk the exploration objective through server-authoritative movement.
  while(!questReady(p,QUESTS[0])){w.command(p,{type:'input',x:0,z:-1});w.step(.05);assert.ok(p.z> -20);}
  at(guide);w.command(p,{type:'quest',action:'complete',id:'first_steps'});assert.equal(p.level,2);
  for(const id of ['practice_fight','gather_herbs'])w.command(p,{type:'quest',action:'accept',id});
  for(const e of w.enemies.slice(0,2)){
    at({x:e.x,z:e.z+2});p.target=e.id;p.auto=true;
    for(let i=0;i<500&&e.hp>0;i++){w.command(p,{type:'skill',skill:skillForRole(p,'primary')});w.step(.05);assert.ok(p.hp>0);}
    assert.equal(e.hp,0);w.command(p,{type:'interact',id:e.id,autoLoot:true});p.auto=false;
  }
  run(8);
  for(const g of GATHERABLES.slice(0,2)){at(g);w.command(p,{type:'interact',id:g.id});run(1.2);}
  at(guide);for(const id of ['practice_fight','gather_herbs']){assert.ok(questReady(p,QUESTS.find(q=>q.id===id)));w.command(p,{type:'quest',action:'complete',id});assert.equal(questRecord(p,id).status,'complete');}
  assert.equal(p.level,3);assert.equal(p.inventory[classId==='scholar'?'practice_staff':'practice_blade'],1);assert.equal(p.inventory.leaf,2);assert.ok(Number.isFinite(p.gold));
  for(const value of Object.values(p.inventory))assert.ok(Number.isFinite(value));
  const saved=structuredClone(w.save(p)),restored=new World().addPlayer(p.name,saved);assert.equal(restored.level,3);assert.equal(restored.classId,classId);assert.equal(restored.raceId,raceId);assert.deepEqual(restored.quests,p.quests);assert.ok(stats(restored).maxHp>0);
});

test('the example crate uses shared collision and jumping, while unrelated-world characters are refused',()=>{
  const w=new World(),p=w.addPlayer('Collision Guest',{x:10,z:0,layoutRevision:1});
  for(let i=0;i<120;i++)advanceMotion(p,{x:1,z:0});assert.ok(p.x<11);
  p.jumpVelocity=7.5;p.grounded=false;for(let i=0;i<30;i++)advanceMotion(p,{x:1,z:0});assert.ok(p.x>11);
  assert.throws(()=>w.addPlayer('Wrong World',{worldId:'another'}),/another world/);
});

test('walk the five-region trail network and finish the two hub breadcrumbs',async()=>{
  const {TRAILS,REGIONS,landscapeAt}=await import('../shared/landscape.js');
  const {heightAt}=await import('../shared/terrain.js');
  const {ZONE_REGIONS,regionAt,interestAt}=await import('../shared/zone-regions.js');
  const {LAYOUT_REVISION}=await import('../shared/zone-layout.js');
  assert.equal(REGIONS.length,5);assert.equal(Object.keys(ZONE_REGIONS).length,5);
  assert.ok(heightAt(28,-46)-heightAt(0,55)>10);
  const visited=new Set();
  // Real shared movement must traverse every path in both directions without
  // teleporting, jumping, getting stuck, or leaving a character above terrain.
  for(const authored of TRAILS)for(const trail of [authored,[...authored].reverse()]){
    const p={x:trail[0][0],z:trail[0][1]};settleOnSurface(p);
    for(const [x,z]of trail.slice(1)){
      let steps=0;
      while(Math.hypot(x-p.x,z-p.z)>.15&&steps++<1500){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);advanceMotion(p,{x:dx/d,z:dz/d});visited.add(regionAt(p.x,p.z));assert.ok(Math.abs(p.y-heightAt(p.x,p.z))<.15);}
      assert.ok(steps<1500,`blocked trail to ${x},${z}`);
    }
  }
  assert.equal(visited.size,5);
  for(const r of REGIONS){assert.equal(landscapeAt(r.x,r.z).id,r.id);assert.equal(interestAt(r.x,r.z).regions.length,5);}
  const w=new World(),p=w.addPlayer('Hub Walker',{layoutRevision:1,x:0,z:12});
  assert.equal(p.layoutRevision,LAYOUT_REVISION);assert.equal(p.x,0);assert.equal(p.z,12);
  p.quests.first_steps={status:'complete',progress:1};
  for(const id of ['willow_welcome','ridge_hello']){
    const q=QUESTS.find(q=>q.id===id),giver=NPCS.find(n=>n.id===q.giver),receiver=NPCS.find(n=>n.id===q.turnIn);
    Object.assign(p,{x:giver.x,z:giver.z});delete p.y;settleOnSurface(p);w.command(p,{type:'quest',action:'accept',id});
    assert.equal(questRecord(p,id)?.status,'active');
    // Walk the breadcrumb objective, retaining authoritative exploration checks.
    let steps=0;while(Math.hypot(p.x-receiver.x,p.z-receiver.z)>1&&steps++<1500){const dx=receiver.x-p.x,dz=receiver.z-p.z,d=Math.hypot(dx,dz);w.command(p,{type:'input',x:dx/d,z:dz/d});w.step(.05);}
    w.command(p,{type:'input',x:0,z:0});assert.ok(questReady(p,q));w.command(p,{type:'quest',action:'complete',id});assert.equal(questRecord(p,id).status,'complete');
  }
  const restored=new World().addPlayer(p.name,w.save(p));assert.equal(restored.quests.ridge_hello.status,'complete');assert.ok(Math.abs(restored.y-heightAt(restored.x,restored.z))<.01);
});
