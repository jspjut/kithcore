import {developerAccess} from './developer.js';
import {regionAt,interestAt} from '../shared/zone-regions.js';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {SOCIAL_RANGE,parseEmoteCommand} from '../shared/social.js';
import {Correspondence} from './correspondence.js';
import { World } from './world.js';
import { ZONE } from '../shared/content.js';
import { CharacterStore, characterApi, RosterError } from './characters.js';
import {WORLD_INFO} from '../shared/world-info.js';
import {bindWorldState} from './world-state.js';
import {openLiveUpdates} from './live-updates.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
await mkdir(DATA, { recursive: true, mode: 0o700 });
await bindWorldState(DATA,WORLD_INFO,{allowLegacy:process.env.ALLOW_LEGACY_SAVES==='1'});
const liveUpdates=await openLiveUpdates(DATA);
const savePath = path.join(DATA, 'characters.json');
const store = await CharacterStore.open(savePath);
const world = new World();world.correspondence=new Correspondence(world,store);
const connections = new Map(), tokens = new Map(), pendingSaves = new Map();
let lastSaveOk=true;
function persist() {
  let updates;
  return store.saveProfiles(()=>{
    updates=new Map(pendingSaves);
    for(const[id,ws]of connections){const p=world.players.get(id);if(p)updates.set(tokens.get(ws),world.save(p));}
    return [...updates];
  }).then(()=>{
    for(const[key,profile]of updates)if(pendingSaves.get(key)===profile)pendingSaves.delete(key);
    lastSaveOk=true;return true;
  }).catch(e=>{lastSaveOk=false;console.error('Character save failed:',e.message);return false;});
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json':'application/json', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if(stopping){res.writeHead(503);return res.end('Server shutting down');}
  if(url==='/live-content.json'&&(req.method==='GET'||req.method==='HEAD')){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(req.method==='HEAD'?undefined:JSON.stringify(liveUpdates.snapshot()));}
  if(url==='/developer'||url==='/developer/'){if(!developerAccess(req)){res.writeHead(404);return res.end('Not found');}url='/';}
  if(url==='/api/developer/characters'){if(!developerAccess(req)||req.method!=='POST'){res.writeHead(404);return res.end('Not found');}return characterApi(req,res,'/api/characters',store,id=>world.players.has(id),{developerCreate:true});}
  if(url.startsWith('/api/'))return characterApi(req,res,url,store,id=>world.players.has(id));
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  if(url==='/world.json'){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(WORLD_INFO));}
  if (url === '/health'||url==='/ready') { res.setHeader('Content-Type', 'application/json');res.setHeader('Cache-Control','no-store');if(url==='/ready'&&!lastSaveOk)res.statusCode=503;return res.end(JSON.stringify({ status:lastSaveOk?'ok':'storage-error',world:WORLD_INFO.id,contentVersion:WORLD_INFO.version,liveRevision:liveUpdates.snapshot().revision,players:world.players.size,capacity:ZONE.maxPlayers,zone:ZONE.name,regions:world.zones.refresh(world.players,world.npcs,world.enemies).counts() })); }
  const routes = [
    ['/vendor/three-addons/', path.join(ROOT, 'node_modules/three/examples/jsm')],
    ['/shared/', path.join(ROOT, 'shared')],
    ['/vendor/three/', path.join(ROOT, 'node_modules/three/build')],
    ['/', path.join(ROOT, 'client')]
  ];
  const [prefix, base] = routes.find(([prefix]) => url.startsWith(prefix));
  const filename = path.resolve(base, url === '/' ? 'index.html' : url.slice(prefix.length));
  if (!filename.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(filename);
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache'); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  // Browser connections must originate on this host. CLI clients may omit Origin.
  let valid = req.url === '/ws';
  if (req.headers.origin) { try { valid &&= new URL(req.headers.origin).host === req.headers.host; } catch { valid = false; } }
  if (stopping || !valid || wss.clients.size >= ZONE.maxPlayers + 16) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws,req));
});
const send = (ws, obj) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256_000) ws.send(JSON.stringify(obj)); };
const deliverScoped=event=>{for(const p of world.zones.recipients(event,world.players)){const ws=connections.get(p.id);if(ws)send(ws,event);}};
wss.on('connection', (ws,req) => {
  let p = null, budget = 100, loggingOut=false;
  const timeout = setTimeout(() => { if (!p) ws.close(1008, 'Join timeout'); }, 10000);
  const refill = setInterval(() => { budget = 100; }, 1000);
  ws.on('error', e => console.warn('WebSocket:', e.message));
  let incoming=Promise.resolve();
  ws.on('message', raw => {
    incoming=incoming.then(()=>handle(raw)).catch(e=>{send(ws,{type:'error',text:e instanceof RosterError?e.message:'Could not load your character. Please try again.'});});
  });
  async function handle(raw){
    if(loggingOut||stopping)return;
    if (--budget < 0) return ws.close(1008, 'Too many messages');
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
    if (!p) {
      if (msg.type !== 'join') return;
      if(msg.worldId&&msg.worldId!==WORLD_INFO.id||msg.contentHash&&msg.contentHash!==WORLD_INFO.contentHash)return send(ws,{type:'error',text:'World content changed. Reload the page before joining.'});
      if (world.players.size >= ZONE.maxPlayers) return send(ws, { type: 'error', text: 'This world is full. Please try again later.' });
      let profileKey;
      const enter=(key,saved)=>{
        if(ws.readyState!==WebSocket.OPEN)return;
        if(world.players.size>=ZONE.maxPlayers)throw new RosterError(409,'This world is full. Please try again later.');
        if(saved?.gameMaster&&(!msg.developer||!developerAccess(req)))throw new RosterError(403,'Use the local developer entry with developer mode enabled.');
        if(saved&&world.players.has(saved.id))throw new RosterError(409,'This character is already playing in another tab. Select another character.');
        const name=(typeof msg.name==='string'?msg.name:'').trim().replace(/[^a-zA-Z0-9 '-]/g,'').slice(0,18);
        if(!saved&&name.length<2)throw new RosterError(400,'Choose a name with 2–18 letters or numbers.');
        if([...world.players.values()].some(v=>v.name.toLowerCase()===(saved?.name||name).toLowerCase())||!saved&&Object.values(store.data.profiles).some(v=>v.name.toLowerCase()===name.toLowerCase()))throw new RosterError(409,'That name is already in the Reach.');
        profileKey=key||randomBytes(32).toString('hex');p=world.addPlayer(saved?.name||name,saved);
        tokens.set(ws,profileKey);connections.set(p.id,ws);clearTimeout(timeout);
      };
      if(msg.accountToken)await store.enter(msg.accountToken,msg.characterId,enter);
      else await store.exclusive(()=>enter(store.profile(msg.token)?msg.token:null,store.profile(msg.token)));
      if(!p)return;
      try{if(!store.profile(profileKey))await store.putProfile(profileKey,world.save(p));}
      catch(e){connections.delete(p.id);world.removePlayer(p.id);tokens.delete(ws);p=null;throw e;}
      send(ws,{type:'welcome',liveContent:liveUpdates.snapshot(),id:p.id,name:p.name,gameMaster:p.gameMaster===true,worldId:WORLD_INFO.id,contentVersion:WORLD_INFO.version,...(!msg.accountToken?{token:profileKey}:{})});send(ws,world.snapshot(p));
      deliverScoped({type:'chat',name:WORLD_INFO.zoneNames[p.mapId]||ZONE.name,text:`${p.name} has arrived.`,system:true,x:p.x,z:p.z,regions:[regionAt(p.x,p.z)]}); persist(); return;
    }
    if(msg.type==='logout'){
      loggingOut=true;detachPlayer();persist().then(saved=>{send(ws,{type:'loggedOut',saved});ws.close(1000,'Logged out');});return;
    }
    if (msg.type === 'ping' && Number.isFinite(msg.clientTime)) {send(ws,{type:'pong',clientTime:msg.clientTime,serverTime:world.time});return;}
    if(msg.type==='mail'||msg.type==='friend'){await world.correspondence.handle(p,msg,tokens.get(ws));return;}
    if(msg.type==='chat'&&typeof msg.text==='string'){
      const match=msg.text.trim().match(/^\/(friend|addfriend|unfriend|removefriend|friends)(?:\s+([\s\S]*))?$/i);
      if(match&&/^(friend|addfriend)$/i.test(match[1])&&!match[2]?.trim()){send(ws,{type:'friends',add:true});return;}
      if(match){if(match[1].toLowerCase()==='friends'){send(ws,{type:'friends'});return;}await world.correspondence.handle(p,{type:'friend',action:/^(unfriend|removefriend)$/i.test(match[1])?'remove':'add',name:match[2]},tokens.get(ws));return;}
    }
    if(msg.type==='chat'&&world.chat.handle(p,msg))return;
    if(msg.type==='chat'&&typeof msg.text==='string'&&msg.text.trim().startsWith('/')){
      const command=parseEmoteCommand(msg.text);if(!command){world.notify(p,'Use /wave, /bow or another learned emote. Open Skills → Emotes for the list.');return;}
      if(command.name){const target=[...world.players.values(),...world.npcs].find(unit=>unit.name.toLowerCase()===command.name.toLowerCase());if(!target){world.notify(p,'No character with that name is here. Select someone nearby or use their full name.');return;}world.social.perform(p,command.id,target.id,'target');}
      else world.command(p,{type:'emote',id:command.id,audience:command.audience||msg.audience});return;
    }
    if(msg.type==='chat')return;
    world.command(p, msg);
  }
  function detachPlayer(){
    if(!p)return;const leaving=p;p=null;
    pendingSaves.set(tokens.get(ws),world.save(leaving));connections.delete(leaving.id);world.removePlayer(leaving.id);tokens.delete(ws);
    deliverScoped({type:'chat',name:WORLD_INFO.zoneNames[leaving.mapId]||ZONE.name,text:`${leaving.name} has left.`,system:true,x:leaving.x,z:leaving.z,regions:[regionAt(leaving.x,leaving.z)]});
  }
  ws.on('close',()=>{clearTimeout(timeout);clearInterval(refill);incoming.finally(()=>{if(p){detachPlayer();persist();}});});

});
let previous = performance.now(), count = 0;
const tick = setInterval(() => {
  const now = performance.now(); world.step((now - previous) / 1000); previous = now;
  for (const event of world.events.splice(0)) {
    if(event.type==='chat'&&event.recipients){const {recipients,...message}=event;for(const id of recipients){const ws=connections.get(id);if(ws)send(ws,message);}}
    else if (event.to) { const ws = connections.get(event.to); if (ws) send(ws, event); }
    else if(event.type==='social'){for(const p of world.zones.recipients(event,world.players)){if(Math.hypot(p.x-event.x,p.z-event.z)<=SOCIAL_RANGE)send(connections.get(p.id),event);}}
    else deliverScoped(event);
  }
  if(++count%2===0){const frame=world.prepareSnapshots();for(const[id,ws]of connections)send(ws,world.snapshot(world.players.get(id),frame));}
}, 50);
const saving = setInterval(persist, 10000);
const updating=setInterval(()=>liveUpdates.poll(a=>world.addLiveActors(a),message=>{
  for(const ws of connections.values()){
    if(ws.bufferedAmount>=256_000)ws.close(1013,'Content update requires reconnect');else send(ws,message);
  }
  for(const text of message.patch.announcements||[])for(const ws of connections.values())send(ws,{type:'chat',name:'Announcement',text,system:true});
}).catch(error=>{console.error('Live update processing failed:',error.message);if(error.fatal)shutdown();}),500);
const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (ws.isAlive === false) ws.terminate(); else { ws.isAlive = false; ws.ping(); } } }, 30000);
wss.on('connection', ws => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
let stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true;
  clearInterval(tick); clearInterval(saving); clearInterval(heartbeat);clearInterval(updating);
  await persist(); for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
  server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
const port = Number(process.env.PORT || 3080), host = process.env.HOST || '0.0.0.0';
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is busy. Run with PORT=3081 ./start.sh to choose another.` : e.message); process.exit(1); });
server.listen(port, host, () => console.log(`${WORLD_INFO.name} · http://localhost:${server.address().port} · ${ZONE.maxPlayers}-player world\nCharacter saves: ${savePath}`));
