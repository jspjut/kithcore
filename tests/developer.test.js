import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import {startTestWorld} from '../tools/testing.js';
import {developerAccess} from '../server/developer.js';
const start=async(enabled,dataDir)=>{const old=process.env.ENABLE_DEVELOPER_MODE;process.env.ENABLE_DEVELOPER_MODE=enabled?'1':'0';try{return await startTestWorld('minimal',{dataDir});}finally{if(old===undefined)delete process.env.ENABLE_DEVELOPER_MODE;else process.env.ENABLE_DEVELOPER_MODE=old;}};
const request=async(base,url,body,token,headers={})=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...headers},body:JSON.stringify(body)});
async function join(base,identity){const socket=new WebSocket(base.replace('http','ws')+'/ws');socket.on('error',()=>{});try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Join timeout')),5000);socket.on('open',()=>socket.send(JSON.stringify({type:'join',...identity})));socket.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='state'||m.type==='error'){clearTimeout(timer);resolve(m);}});});}finally{socket.close();}}

test('developer access requires explicit server enablement, a direct loopback connection and a matching origin',()=>{
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:3080',origin:'http://localhost:3080'}};
 assert.equal(developerAccess(req,false),false);assert.equal(developerAccess(req,true),true);
 assert.equal(developerAccess({...req,socket:{remoteAddress:'203.0.113.4'}},true),false);
 assert.equal(developerAccess({...req,headers:{...req.headers,'x-forwarded-for':'203.0.113.4'}},true),false);
 assert.equal(developerAccess({...req,headers:{...req.headers,origin:'https://elsewhere.invalid'}},true),false);
});
test('only the local developer endpoint mints GM explorers; roles persist and cannot enter when developer access is disabled',async t=>{
 const dataDir=await mkdtemp(path.join(tmpdir(),'mmo-developer-'));t.after(()=>rm(dataDir,{recursive:true,force:true}));let server=await start(true,dataDir);t.after(()=>server.stop());
 assert.equal((await fetch(server.base+'/developer')).status,200);
 const account=await (await request(server.base,'/api/session',{})).json();
 const normal=await(await request(server.base,'/api/characters',{name:'Normal Explorer',revision:account.revision,gameMaster:true},account.token)).json();assert.ok(normal.createdId);
 const gm=await(await request(server.base,'/api/developer/characters',{name:'GM Explorer',revision:normal.revision},account.token)).json();assert.ok(gm.createdId);
 const profiles=Object.values(JSON.parse(await readFile(path.join(dataDir,'characters.json'),'utf8')).profiles);assert.notEqual(profiles.find(p=>p.name==='Normal Explorer').gameMaster,true);assert.equal(profiles.find(p=>p.name==='GM Explorer').gameMaster,true);
 const identity={accountToken:account.token,characterId:gm.createdId};assert.equal((await join(server.base,identity)).type,'error');assert.equal((await join(server.base,{...identity,developer:true})).self.gameMaster,true);
 assert.equal((await request(server.base,'/api/developer/characters',{name:'Proxy Explorer',revision:gm.revision},account.token,{'x-forwarded-for':'203.0.113.4'})).status,404);
 await server.stop();server=await start(false,dataDir);assert.equal((await fetch(server.base+'/developer')).status,404);assert.equal((await request(server.base,'/api/developer/characters',{},account.token)).status,404);assert.equal((await join(server.base,{...identity,developer:true})).type,'error');
 const ordinary=await join(server.base,{accountToken:account.token,characterId:normal.createdId,developer:true,gameMaster:true});assert.notEqual(ordinary.self.gameMaster,true);
});
