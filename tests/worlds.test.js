import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import WebSocket from 'ws';
import {loadWorld,validateManifest,prepareRuntime,ROOT} from '../tools/worlds.js';
import {validateRuntime} from '../tools/validate-runtime.js';
import {startTestWorld} from '../tools/testing.js';
import {bindWorldState} from '../server/world-state.js';
import {pathToFileURL} from 'node:url';

async function temporary(t){const directory=await mkdtemp(path.join(tmpdir(),'kithcore-contract-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
async function guest(base,name,identity={}){
  const ws=new WebSocket(base.replace('http:','ws:')+'/ws'),queue=[],waiters=[];
  ws.on('message',raw=>{const value=JSON.parse(raw);const index=waiters.findIndex(w=>w.predicate(value));if(index>=0){const[w]=waiters.splice(index,1);clearTimeout(w.timer);w.resolve(value);}else queue.push(value);});
  const next=(predicate,timeout=5000)=>{
    const index=queue.findIndex(predicate);if(index>=0)return Promise.resolve(queue.splice(index,1)[0]);
    return new Promise((resolve,reject)=>{const waiter={predicate,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error('Protocol timeout'));},timeout)};waiters.push(waiter);});
  };
  await once(ws,'open');ws.send(JSON.stringify({type:'join',name,...identity}));
  return {ws,next,send:value=>ws.send(JSON.stringify(value)),async close(){if(ws.readyState===WebSocket.CLOSED)return;const done=once(ws,'close');ws.close();await done;}};
}

test('the included world validates and runs against the same simulation, collision and save contracts',async t=>{
  const parent=await temporary(t),runtime=await prepareRuntime('minimal',{parent});
  assert.deepEqual(await validateRuntime(runtime.directory),{id:'minimal',version:runtime.manifest.version,npcs:5,quests:5,enemies:8,items:10});
  const info=await readFile(path.join(runtime.directory,'shared/world-info.js'),'utf8');assert.match(info,/contentHash/);assert.doesNotMatch(info,/DATA_DIR|accountToken/);
  const {storageKey}=await import(pathToFileURL(path.join(runtime.directory,'shared/world-storage.js')).href);assert.equal(storageKey('account'),'minimal-account');
});

test('worlds share the actual client and customize it through validated game files',async t=>{
  const parent=await temporary(t),source=await loadWorld('minimal'),copy=path.join(parent,'custom');await cp(source.directory,copy,{recursive:true});
  const manifest={...source.manifest,id:'custom',client:{entry:'/custom-client.js',stylesheet:'/custom.css',extension:'/custom-ui.js'}};
  await writeFile(path.join(copy,'world.json'),JSON.stringify(manifest));
  await writeFile(path.join(copy,'client/custom-client.js'),"export * from '/main.js';\n");await writeFile(path.join(copy,'client/custom.css'),':root{--gold:#aaccee}');await writeFile(path.join(copy,'client/custom-ui.js'),'export function setup(context){}');
  const runtime=await prepareRuntime(copy,{parent});
  assert.equal(await readFile(path.join(runtime.directory,'client/main.js'),'utf8'),await readFile(path.join(ROOT,'client/main.js'),'utf8'));
  assert.ok(!runtime.files.includes('client/main.js'));assert.ok(!runtime.files.includes('client/roster.js'));
  const info=await readFile(path.join(runtime.directory,'shared/world-info.js'),'utf8');assert.match(info,/custom-client.js/);assert.match(info,/custom-ui.js/);
  const icons=await readFile(path.join(runtime.directory,'client/icons.svg'),'utf8');assert.match(icons,/id="race-human"/);assert.match(icons,/id="race-harefolk"/);assert.doesNotMatch(icons,/race-(sylvren|cairnkin|brinefolk|emberkin)/);
  assert.throws(()=>validateManifest({...manifest,client:{entry:'https://example.com/client.js'}}),/local client/);
  assert.throws(()=>validateManifest({...manifest,client:{stylesheet:'/../secret.css'}}),/local client/);
  await writeFile(path.join(copy,'world.json'),JSON.stringify({...manifest,client:{extension:'/missing.js'}}));await assert.rejects(loadWorld(copy),/Missing client customization/);
});

test('pack validation rejects incompatible APIs, engine replacement and links outside a pack',async t=>{
  const source=await loadWorld('minimal'),parent=await temporary(t),copy=path.join(parent,'custom');await cp(source.directory,copy,{recursive:true});
  assert.throws(()=>validateManifest({...source.manifest,runtimeApi:999}),/Unsupported/);
  assert.throws(()=>validateManifest({...source.manifest,id:'../secret'}),/World id/);
  await writeFile(path.join(copy,'server/index.js'),'throw Error("replacement");');await assert.rejects(loadWorld(copy),/replace engine file/);
  await rm(path.join(copy,'server/index.js'));await symlink(path.join(ROOT,'package.json'),path.join(copy,'client/secret.json'));await assert.rejects(loadWorld(copy),/Symbolic links/);
});

test('world identity guards saves and requires explicit permission for a legacy document',async t=>{
  const directory=await temporary(t),world={id:'minimal',runtimeApi:1};await writeFile(path.join(directory,'characters.json'),'{}');
  await assert.rejects(bindWorldState(directory,world),/ALLOW_LEGACY_SAVES/);
  assert.equal(await readFile(path.join(directory,'characters.json'),'utf8'),'{}');
  await bindWorldState(directory,world,{allowLegacy:true});await bindWorldState(directory,world);
  await assert.rejects(bindWorldState(directory,{id:'another',runtimeApi:1}),/belongs to world minimal/);
  await assert.rejects(bindWorldState(directory,{id:'minimal',runtimeApi:2}),/API 1/);
});

test('HTTP and real sockets isolate content, reject mismatches, share state and persist a character through restart',async t=>{
  const parent=await mkdtemp(path.join(tmpdir(),'kithcore-contract-')),data=path.join(parent,'saves');
  const clients=[];let server;
  // Stop every writer before removing saves; earlier cleanup raced shutdown writes.
  t.after(async()=>{
    try{await Promise.all(clients.map(c=>c.close()));}
    finally{try{await server?.stop();}finally{await rm(parent,{recursive:true,force:true});}}
  });
  server=await startTestWorld('minimal',{dataDir:data});
  const info=await(await fetch(server.base+'/world.json')).json();assert.equal(info.id,'minimal');assert.match(info.contentHash,/^[a-f0-9]{64}$/);
  assert.equal((await fetch(server.base+'/ready')).status,200);
  for(const file of ['/worlds/minimal/world.json','/data/characters.json','/server/world.js','/package.json','/game-data/story/alderhaven.json'])assert.equal((await fetch(server.base+file)).status,404,file);
  const wrong=await guest(server.base,'Wrong World',{worldId:'another',contentHash:info.contentHash});clients.push(wrong);assert.match((await wrong.next(m=>m.type==='error')).text,/Reload/);await wrong.close();
  const a=await guest(server.base,'Sample One',{worldId:info.id,contentHash:info.contentHash});clients.push(a);const welcome=await a.next(m=>m.type==='welcome');assert.equal(welcome.worldId,'minimal');
  const b=await guest(server.base,'Sample Two');clients.push(b);await b.next(m=>m.type==='welcome');const shared=await b.next(m=>m.type==='state'&&m.players.length===2);assert.equal(shared.self.worldId,'minimal');assert.equal(JSON.stringify(shared).includes(welcome.token),false);
  a.send({type:'chat',text:'Hello from the minimal example'});assert.equal((await b.next(m=>m.type==='chat'&&m.text==='Hello from the minimal example')).name,'Sample One');
  a.send({type:'quest',action:'accept',id:'first_steps'});await a.next(m=>m.type==='state'&&m.self.quests.first_steps?.status==='active');
  const timer=setInterval(()=>a.send({type:'input',x:0,z:-1}),100);
  try{await a.next(m=>m.type==='state'&&m.self.quests.first_steps?.progress===1,8000);}finally{clearInterval(timer);a.send({type:'input',x:0,z:0});}
  a.send({type:'logout'});assert.equal((await a.next(m=>m.type==='loggedOut')).saved,true);await a.close();await b.close();await server.stop();
  const stored=JSON.parse(await readFile(path.join(data,'characters.json'),'utf8'));assert.equal(stored.profiles[welcome.token].worldId,'minimal');assert.equal(stored.profiles[welcome.token].quests.first_steps.progress,1);
  server=await startTestWorld('minimal',{dataDir:data});const resumed=await guest(server.base,'Ignored',{token:welcome.token});clients.push(resumed);assert.equal((await resumed.next(m=>m.type==='welcome')).id,welcome.id);assert.equal((await resumed.next(m=>m.type==='state')).self.quests.first_steps.progress,1);
});


test('rebuilding optional art preserves world identity while source changes invalidate the content baseline',async t=>{
 const source=await loadWorld('minimal'),parent=await temporary(t),directory=path.join(parent,'art-baseline');await cp(source.directory,directory,{recursive:true});
 const original=(await loadWorld(directory)).contentHash;
 for(const folder of ['models','previews','icons'])await mkdir(path.join(directory,'client/assets',folder),{recursive:true});
 for(const [file,bytes]of [['models/example.glb',Buffer.from([0,1,2])],['previews/example.png',Buffer.from([3,4,5])],['icons/example.svg','<svg/>'],['library-manifest.json','{}'],['catalog.html','<html/>']])await writeFile(path.join(directory,'client/assets',file),bytes);
 assert.equal((await loadWorld(directory)).contentHash,original);
 const runtime=await prepareRuntime(directory,{parent});assert.equal(runtime.contentHash,original);assert.deepEqual(await readFile(path.join(runtime.directory,'client/assets/models/example.glb')),Buffer.from([0,1,2]));
 const scene=path.join(directory,'client/world-presentation.js');await writeFile(scene,(await readFile(scene,'utf8'))+'\n// Authored world change\n');assert.notEqual((await loadWorld(directory)).contentHash,original);
});
