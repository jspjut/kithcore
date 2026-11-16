import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import WebSocket from 'ws';
import {ROOT,prepareRuntime} from '../tools/worlds.js';
import {startTestWorld} from '../tools/testing.js';
const example=JSON.parse(await readFile(path.join(ROOT,'worlds/minimal/examples/live-update.json'),'utf8'));
async function temporary(t){const p=await mkdtemp(path.join(tmpdir(),'mmo-live-test-'));t.after(()=>rm(p,{recursive:true,force:true}));return p;}
async function command(data,file,...options){
 const child=spawn(process.execPath,[path.join(ROOT,'tools/live-update.js'),'--data-dir',data,'--file',file,...options],{stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);const [code]=await once(child,'exit');return {code,output};
}
async function guest(base,identity={}){
 const ws=new WebSocket(base.replace('http:','ws:')+'/ws'),queue=[],waiters=[];ws.on('message',bytes=>{const msg=JSON.parse(bytes);const i=waiters.findIndex(w=>w.predicate(msg));if(i<0)queue.push(msg);else{const [w]=waiters.splice(i,1);clearTimeout(w.timer);w.resolve(msg);}});
 const next=predicate=>{const i=queue.findIndex(predicate);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={predicate,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Live protocol timeout'));},6000)};waiters.push(w);});};
 await once(ws,'open');ws.send(JSON.stringify({type:'join',name:'Live Tester',...identity}));return {ws,next,send:msg=>ws.send(JSON.stringify(msg)),async close(){if(ws.readyState===WebSocket.CLOSED)return;const done=once(ws,'close');ws.close();await done;}};
}
test('live updates reject replacements, broken references, cycles and unsafe mechanics without mutating registries',async t=>{
 const parent=await temporary(t),runtime=await prepareRuntime('minimal',{parent});
 const live=await import(pathToFileURL(path.join(runtime.directory,'shared/live-content.js')).href),content=await import(pathToFileURL(path.join(runtime.directory,'shared/content.js')).href);
 const before=JSON.stringify([content.ITEMS,content.NPCS,content.QUESTS,content.SKILLS,content.MERCHANT_STOCK]);
 const bads=[{...example,items:{potion:{template:'potion'}}},{...example,remove:['guide']},{...example,abilities:{oops:{template:'recall'}}},{...example,merchantStock:['unknown']},{...example,spawns:[{id:'bad',type:'slime',x:Infinity,z:0}]},{...example,quests:example.quests.map(q=>({...q,requires:[q.id]}))},{...example,dialogue:{absent:{greeting:'Hello'}}},{...example,items:{bad:{template:'potion',values:{price:-1}}}}];
 for(const bad of bads)assert.throws(()=>live.prepareLivePatch(bad));assert.equal(JSON.stringify([content.ITEMS,content.NPCS,content.QUESTS,content.SKILLS,content.MERCHANT_STOCK]),before);assert.equal(live.LIVE_CONTENT.revision,0);
});
test('operators validate and apply while a character stays connected, then replay additions and saves on restart',async t=>{
 const parent=await temporary(t),data=path.join(parent,'saves'),file=path.join(parent,'update.json');await writeFile(file,JSON.stringify(example));let server=await startTestWorld('minimal',{dataDir:data}),clients=[];
 t.after(async()=>{await Promise.all(clients.map(c=>c.close()));await server.stop();});let a=await guest(server.base);clients.push(a);const welcome=await a.next(m=>m.type==='welcome');await a.next(m=>m.type==='state');
 assert.equal((await command(data,file,'--check')).code,0);assert.equal((await(await fetch(server.base+'/live-content.json')).json()).revision,0);
 assert.equal((await command(data,file)).code,0);assert.equal((await a.next(m=>m.type==='contentUpdate')).revision,1);await a.next(m=>m.type==='chat'&&m.name==='Announcement');
 const state=await a.next(m=>m.type==='state'&&m.npcs.some(n=>n.id==='market_guide')&&m.enemies.some(e=>e.id==='live-mob-market_practice'));assert.equal(state.self.id,welcome.id);assert.equal(a.ws.readyState,WebSocket.OPEN);
 a.send({type:'trade',action:'buy',item:'market_tonic'});await a.next(m=>m.type==='state'&&m.self.inventory.market_tonic===1);
 a.send({type:'quest',action:'accept',id:'market_lesson'});await a.next(m=>m.type==='state'&&m.self.quests.market_lesson?.status==='active');
 a.send({type:'target',id:'live-mob-market_practice'});a.send({type:'skill',skill:'market_strike'});await a.next(m=>m.type==='state'&&m.self.quests.market_lesson?.progress===1&&m.self.cooldowns.market_strike>0);
 await a.next(m=>m.type==='state'&&m.self.hp<m.self.maxHp);a.send({type:'trade',action:'buy',item:'market_tonic'});await a.next(m=>m.type==='state'&&m.self.inventory.market_tonic===2);a.send({type:'potion',item:'market_tonic'});await a.next(m=>m.type==='state'&&m.self.inventory.market_tonic===1&&m.self.cooldowns.potion>0);
 assert.equal((await command(data,file)).code,0);assert.equal((await(await fetch(server.base+'/live-content.json')).json()).revision,1);
 const invalid={id:'bad-second',worldId:'minimal',merchantStock:['missing'],dialogue:{guide:{greeting:'Must not appear'}}};await writeFile(file,JSON.stringify(invalid));assert.equal((await command(data,file)).code,1);assert.equal(JSON.parse(await readFile(path.join(data,'live-content.json'),'utf8')).revision,1);
 a.send({type:'logout'});await a.next(m=>m.type==='loggedOut');await a.close();await server.stop();server=await startTestWorld('minimal',{dataDir:data});a=await guest(server.base,{token:welcome.token});clients.push(a);
 const sync=(await a.next(m=>m.type==='welcome')).liveContent;assert.equal(sync.revision,1);assert.equal(sync.patches[0].dialogue.guide.greeting,example.dialogue.guide.greeting);
 const restored=await a.next(m=>m.type==='state');assert.equal(restored.self.id,welcome.id);assert.equal(restored.self.inventory.market_tonic,1);assert.equal(restored.self.quests.market_lesson.progress,1);assert.equal(restored.enemies.filter(e=>e.id==='live-mob-market_practice').length,1);
 // A different content baseline must not silently strand references in saves.
 await a.close();await server.stop();const journal=JSON.parse(await readFile(path.join(data,'live-content.json'),'utf8'));journal.baseContentHash='different';await writeFile(path.join(data,'live-content.json'),JSON.stringify(journal));await assert.rejects(startTestWorld('minimal',{dataDir:data}),/baseline changed/);
});

test('a failed durable write leaves definitions untouched; stale concurrent submissions are rejected',async t=>{
 const parent=await temporary(t),runtime=await prepareRuntime('minimal',{parent}),data=path.join(parent,'control');
 const {mkdir,rename}=await import('node:fs/promises');await mkdir(data);
 const {openLiveUpdates}=await import(pathToFileURL(path.join(runtime.directory,'server/live-updates.js')).href),{LIVE_CONTENT}=await import(pathToFileURL(path.join(runtime.directory,'shared/live-content.js')).href);
 const service=await openLiveUpdates(data),journal=path.join(data,'live-content.json'),saved=path.join(data,'held-journal.json');const baseline=JSON.parse(await readFile(journal,'utf8'));
 const first='00000000-0000-0000-0000-000000000001.json',second='00000000-0000-0000-0000-000000000002.json';
 const request=(id,revision=0)=>({baseContentHash:baseline.baseContentHash,expectedRevision:revision,patch:{id,worldId:'minimal',announcements:['A validated message']}});
 await rename(journal,saved);await mkdir(journal);await writeFile(path.join(data,'live-inbox',first),JSON.stringify(request('cannot-write')));let mutations=0;
 await service.poll(()=>mutations++,()=>mutations++);assert.equal(mutations,0);assert.equal(LIVE_CONTENT.revision,0);assert.equal(JSON.parse(await readFile(path.join(data,'live-receipts',first),'utf8')).ok,false);
 await rm(journal,{recursive:true});await rename(saved,journal);await rm(path.join(data,'live-receipts',first));
 await writeFile(path.join(data,'live-inbox',first),JSON.stringify(request('first-change')));await writeFile(path.join(data,'live-inbox',second),JSON.stringify(request('stale-change')));
 await service.poll(()=>mutations++,()=>mutations++);assert.equal(LIVE_CONTENT.revision,1);assert.equal(mutations,2);assert.match(JSON.parse(await readFile(path.join(data,'live-receipts',second),'utf8')).error,/Stale update/);
});
