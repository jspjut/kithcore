import {FlightPresentation} from './flight-presentation.js';
import {UI_CONFIG,trackerEmpty} from './world-ui.js';
import {LIVE_CONTENT,applyLiveSnapshot,prepareLivePatch,commitLivePatch} from '/shared/live-content.js';
import {applyBranding} from './branding.js';
import {WORLD_INFO} from '/shared/world-info.js';
import {MAILBOXES} from '/shared/mail.js';
import {CorrespondenceUI} from './correspondence-ui.js';
import {zoneAt} from '/shared/zone-layout.js';
import {READABLES,readableAvailable} from '/shared/readables.js';
import {CHAT_CHANNELS} from '/shared/chat.js';
import {GATHER_CAST_TIME,gatherAvailable,gatherLabel} from '/shared/gathering.js';
import {ChatPanel} from './chat-panel.js';
import {SocialChat} from './social-chat.js';
import {heightAt as heightAtForSign} from '/shared/terrain.js';
import {roadDirection} from '/shared/roadsigns.js';
import {EMOTES} from '/shared/social.js';
import {clampCameraPitch} from './camera-look.js';
import {CameraPointerLock} from './pointer-lock.js';
import {AdventureControls} from './controls.js';
import { GameScene } from './scene.js';
import { CharacterRoster } from './roster.js';
import { buildingAt } from '/shared/buildings.js';
import { Preferences } from './settings.js';
import { GameMenu } from './menu.js';
import { GameUI } from './ui.js';
import { MovementPredictor, NetworkClock, CastPresentation, GlobalCooldownPresentation } from './netcode.js';
import {classDefinition,learnedSkill,skillForRole} from '/shared/adventurers.js';
import {LIVE_LEVEL_CAP} from '/shared/progression.js';
import { SKILLS } from '/shared/content.js';
import { MAP_RADII, TRACKING_OPTIONS, OBJECTIVE_OPTIONS } from './minimap.js';
import { QUESTS, NPCS, GATHERABLES, RESOURCE_TYPES, ENEMY_TYPES, LEVEL_XP, LANDMARKS, questRecord, questReady, questDone, questAvailable, activeQuests, trackedQuest } from '/shared/content.js';

const $=s=>document.querySelector(s);
applyBranding();
let preferenceStorage;try{preferenceStorage=localStorage;}catch{}
const preferences=new Preferences(preferenceStorage);
let scene;
try { scene=new GameScene($('#world')); }
catch(e){$('#login-error').textContent='A WebGL-capable desktop browser is required. Enable hardware acceleration and reload.';$('#join').disabled=true;throw e;}
let socket=null,selfId=null,state=null,playing=false,joining=false,nearby=null;
let session=null;
const keys=new Set(),controls=new AdventureControls();let cameraPointerId=null,controlHint='';
let currentArea='',lastOutdoorArea='',announceTimer=null,questSignature='',audio=null,audioMaster=null,audioEnabled=false,lastSound=0;
let loggingOut=false,logoutAcknowledged=false,logoutSaved=false,logoutTimer=null,controlSignature='';
const flight=new FlightPresentation(heightAtForSign),motion=new MovementPredictor(),networkClock=new NetworkClock(),casts=new CastPresentation(),globalCooldown=new GlobalCooldownPresentation();
let control={x:0,z:0},lastMotionSend=0,lastPing=0,lastMapDraw=0,targetSequence=0,autoSequence=0,pendingTarget=null,pendingAuto=null;
let fpsFrames=0,fpsStart=performance.now();
const sendRaw=msg=>{if(socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(msg));return true;};
function cancelCasting(){if(casts.current){const id=casts.current.requestId,gathering=casts.current.skill==='gather';sendRaw({type:'cancelCast',requestId:id});casts.cancel();if(!gathering)globalCooldown.cancelCast(id);ui.updateBar();}}
function send(msg){
  if(socket?.readyState!==WebSocket.OPEN)return false;
  if(msg.type==='input'){controls.autorun=false;control={x:0,z:0};return true;}
  if(msg.type==='jump'){if(state?.self.hp>0){cancelCasting();motion.jump();}return true;}
  if(msg.type==='interact'){
    const object=GATHERABLES.find(g=>g.id===(msg.id||nearby?.id)),p=state?.self;
    if(object&&gatherAvailable(p,object)&&Math.hypot(object.x-(motion.pose||p).x,object.z-(motion.pose||p).z)<=4.8){
      if(casts.current)return false;
      if(control.x||control.z||motion.pose?.grounded===false||motion.pose?.jumpHeight>0||motion.pose?.jumpVelocity>0){toast('You must stand still to gather.');return false;}
      msg={...msg,requestId:++casts.sequence};motion.flush(sendRaw);casts.start('gather',{name:gatherLabel(object),castTime:GATHER_CAST_TIME},performance.now(),msg.requestId);
    }
  }
  if(msg.type==='skill'){
    const s=SKILLS[msg.skill],p=state?.self,now=performance.now();if(!s||!p||p.hp<=0||!learnedSkill(p,msg.skill))return false;
    if(casts.current||globalCooldown.remaining(now)>0)return false;
    msg={...msg,requestId:++casts.sequence};
    if(p.level<s.level||(p.cooldowns[msg.skill]||0)>networkClock.time(now)||p.energy<s.cost)return sendRaw(msg);
    if(s.castTime&&(control.x||control.z||motion.pose?.grounded===false||motion.pose?.jumpHeight>0||motion.pose?.jumpVelocity>0)){toast('You must stand still to cast.');return false;}
    const origin=motion.pose||p,inRange=unit=>unit&&unit.hp>0&&Math.hypot(unit.x-origin.x,unit.z-origin.z)<=s.range;
    let valid;
    if(s.travel)valid=true;
    else if(s.selfOnly||s.partyHeal)valid=true;
    else if(s.heal||s.friendlyTarget){const recipient=p.target==null||state.enemies.some(e=>e.id===p.target)?p:state.players.find(v=>v.id===p.target)||(s.heal?(state.npcs||[]).find(v=>v.id===p.target):null);valid=recipient?.id===p.id||inRange(recipient);}
    else if(s.shield)valid=true;
    else if(s.area&&!s.targetArea)valid=state.enemies.some(e=>!e.evading&&inRange(e));
    else{const enemy=state.enemies.find(e=>e.id===p.target);valid=enemy&&!enemy.evading&&inRange(enemy);}
    if(!valid)return sendRaw(msg);
    if(s.castTime)casts.start(msg.skill,s,now,msg.requestId);
    if(s.triggersGCD!==false)globalCooldown.start(msg.requestId,now);motion.flush(sendRaw);ui.flashAction(msg.skill);ui.updateBar();
  }
  if(msg.type==='target'){
    msg={...msg,passive:msg.passive!==false,seq:++targetSequence};pendingTarget={seq:msg.seq,id:msg.id};
    if(state){state.self.target=msg.id;if(msg.passive){state.self.auto=false;send({type:'auto',enabled:false});}ui.updateBar();updateHUD();}
  }
  if(msg.type==='auto'&&state?.self.hp>0){
    msg={...msg,enabled:typeof msg.enabled==='boolean'?msg.enabled:!state.self.auto,seq:++autoSequence};pendingAuto={seq:msg.seq,enabled:msg.enabled};state.self.auto=msg.enabled;ui.updateBar();
  }
  return sendRaw(msg);
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const ui=new GameUI({send,getState:()=>state,getCooldownState:()=>{const now=performance.now();return {time:networkClock.time(now),globalRemaining:globalCooldown.remaining(now)};},toast,drawMap:(canvas,large)=>scene.drawMap(canvas,large)});
const menu=new GameMenu({preferences,onOpen:()=>{ui.cancelDrag?.();controls.stop();keys.clear();control={x:0,z:0};stopCameraDrag();closeMapTracking();$('#chat-input').blur();$('#chat-suggestions').classList.add('hidden');$('#game-tooltip').classList.add('hidden');},onChange:()=>applyPreferences(true),onLogout:beginLogout,onHelp:()=>{const help=ui.windows.get('help');if(help)ui.windows.focus(help);else ui.toggleHelp();},getAutoLoot:()=>ui.autoLoot,setAutoLoot:value=>ui.setAutoLoot(value)});
function applyPreferences(userGesture=false){
  const settings=preferences.settings;audioEnabled=settings.sound;$('#audio-button').textContent=audioEnabled?'♫ ON':'♫ OFF';$('#net-stats').classList.toggle('hidden',!settings.showPerformance);scene.applyPreferences(settings);
  if(audioEnabled&&userGesture&&!audio){audio=new AudioContext();audioMaster=audio.createGain();audioMaster.connect(audio.destination);const ambience=audio.createGain();ambience.gain.value=.015;ambience.connect(audioMaster);for(const frequency of [130.81,196,261.63]){const osc=audio.createOscillator();osc.type='sine';osc.frequency.value=frequency;osc.connect(ambience);osc.start();}}
  if(audio){audioMaster.gain.value=settings.volume;if(!audioEnabled)audio.suspend().catch(()=>{});else if(userGesture)audio.resume().catch(()=>{});}
  const signature=JSON.stringify(preferences.bindings);if(signature!==controlSignature){controlSignature=signature;ui.setActionKeys(Array.from({length:12},(_,i)=>preferences.label(`action${i+1}`,true)));updateControlHint();$('#interaction kbd').textContent=preferences.label('interact',true);$('#chat-write').textContent=`${preferences.label('chat')} ↵`;$('#journal-button').textContent=preferences.label('journal',true);
    for(const[id,action,label]of [['bag-button','bags','Backpack and bags'],['character-button','character','Character'],['spellbook-button','spellbook','Spellbook'],['quest-menu-button','journal','Quest log'],['map-menu-button','map','World map'],['map-button','map','World map'],['help-button','help','Help']]){const button=$('#'+id);if(button.querySelector('kbd'))button.querySelector('kbd').textContent=preferences.label(action,true);button.title=`${label} (${preferences.label(action)})`;button.setAttribute('aria-label',button.title);}
  }
}
$('#main-menu-button').onclick=()=>{if(playing&&!loggingOut)menu.visible?menu.hide():menu.open();};
applyPreferences();
function beginLogout(){
  if(loggingOut)return;loggingOut=true;logoutAcknowledged=false;logoutSaved=false;controls.stop();keys.clear();control={x:0,z:0};stopCameraDrag();cancelCasting();
  if(!menu.visible)menu.open();menu.setBusy();
  if(socket?.readyState!==WebSocket.OPEN){socket?.close();socket=null;finishLogout();return;}
  send({type:'auto',enabled:false});motion.flush(sendRaw);sendRaw({type:'logout'});const connection=socket;logoutTimer=setTimeout(()=>{if(loggingOut&&socket===connection)connection.close(1000,'Logout requested');},6000);
}
function finishLogout(){socialChat.close();chatPanel.reset();correspondence.reset();
  clearTimeout(logoutTimer);loggingOut=false;playing=false;joining=false;selfId=null;state=null;nearby=null;pendingTarget=null;pendingAuto=null;targetSequence=0;autoSequence=0;questSignature='';currentArea='';lastOutdoorArea='';controls.reset();keys.clear();control={x:0,z:0};motion.reset();flight.reset();networkClock.reset();globalCooldown.reset();casts.current=null;casts.epoch=null;casts.sequence=0;ui.resetSession();scene.resetSession();menu.reset();clearTimeout(announceTimer);$('#location-announcement').style.opacity='0';
  $('#hud').classList.add('hidden');$('#disconnected').classList.add('hidden');$('#target-frame').classList.add('hidden');$('#party-frame').classList.add('hidden');$('#party-invitation').classList.add('hidden');$('#chat-input').value='';$('#chat-input').classList.add('hidden');$('#chat-messages').replaceChildren();$('#quest-content').replaceChildren();$('#player-name').textContent='';$('#toasts').replaceChildren();$('#floaters').replaceChildren();$('#map-marker-tooltip').classList.add('hidden');$('#game-tooltip').classList.add('hidden');$('#login').classList.remove('hidden');$('#join').disabled=false;$('#login-error').textContent='';$('#login-status').textContent=logoutAcknowledged&&logoutSaved?'Character saved. Choose a character to continue.':logoutAcknowledged?'The server could not write the latest save. Reconnect to your character.':'Connection closed before save confirmation. Continue to resume your last saved position.';roster.refresh();audio?.suspend().catch(()=>{});$('#join').focus();
}
$('#disconnected-logout').onclick=beginLogout;
if(new URLSearchParams(location.search).get('debug')==='1')Object.defineProperty(window,'mmoDebug',{get:()=>({state,contentRevision:LIVE_CONTENT.revision,local:state?.self.transit?scene.localPose:motion.visual(),controls:{autorun:controls.autorun,heading:controls.heading,bothButtons:controls.bothButtons,buttons:[...controls.buttons.keys()]},authoritative:state?{x:state.self.x,z:state.self.z,y:state.self.y,grounded:state.self.grounded,supportId:state.self.supportId,jumpHeight:state.self.jumpHeight,lastInputSeq:state.self.lastInputSeq}:null,character:scene.characterDebug(),building:scene.buildings.debug(),selection:scene.selection.debug(),groundAreas:scene.groundAreaDebug(),terrain:scene.terrain.debug(),units:scene.unitDebug(),gatherables:[...scene.gathers.values()].map(e=>({id:e.data.id,screen:scene.project(e.data.x,heightAtForSign(e.data.x,e.data.z)+.6,e.data.z)})),readables:[...scene.gathers.values()].filter(e=>e.data.storyId).map(e=>({id:e.data.id,visible:e.object.visible,screen:scene.project(e.data.x,heightAtForSign(e.data.x,e.data.z)+1,e.data.z)})),quietPool:scene.poolDebug(),signs:scene.signDebug(),environment:{time:scene.windUniforms[0]?.value,shaderErrors:scene.renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length},globalCooldown:{remaining:globalCooldown.remaining(performance.now()),requestId:globalCooldown.current?.requestId,confirmed:globalCooldown.current?.confirmed},pendingCommands:motion.pending.length,rtt:networkClock.rtt,settings:{...preferences.settings},view:{cameraHeading:scene.yaw+Math.PI,cameraPitch:scene.pitch,pointerLocked:cameraMouse.locked,pointerLockPending:cameraMouse.pending,cursor:{...cameraMouse.point},pixelRatio:scene.renderer.getPixelRatio(),shadows:scene.renderer.shadowMap.enabled},audio:{enabled:audioEnabled,volume:audioMaster?.gain.value??0,state:audio?.state||'uninitialized'},render:{...scene.renderer.info.render},minimap:{filters:{...scene.tracking},regions:(scene.mapQuestRegions||[]).map(r=>({id:r.quest.id,title:r.quest.title,x:r.x,y:r.y,radius:r.radius})),markers:scene.minimapHits.map(({id,kind,x,y,radius,quests})=>({id,kind,x,y,radius,quests}))}})});
// Compatibility alias for older demo regression scripts; new tools use mmoDebug.
// Legacy debug alias retained for existing Emberwild tools; new tools use mmoDebug.
if(new URLSearchParams(location.search).get('debug')==='1')Object.defineProperty(window,'emberwildDebug',{get:()=>window.mmoDebug});
function zoomMap(delta){scene.zoomMinimap(delta);$('#minimap-scale').textContent=`${MAP_RADII[scene.mapZoomIndex]*2}p`;$('#minimap-zoom-in').disabled=scene.mapZoomIndex===0;$('#minimap-zoom-out').disabled=scene.mapZoomIndex===MAP_RADII.length-1;scene.drawMap($('#minimap'));}
$('#minimap-zoom-in').onclick=()=>zoomMap(-1);$('#minimap-zoom-out').onclick=()=>zoomMap(1);
$('#minimap').addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();zoomMap(e.deltaY>0?1:-1);},{passive:false});zoomMap(0);

function closeMapTracking(){$('#minimap-tracking-menu').classList.add('hidden');$('#minimap-tracking-button').setAttribute('aria-expanded','false');$('#map-marker-tooltip').classList.add('hidden');}
const trackingCheckbox=([id,label])=>`<label><input type="checkbox" data-tracking="${id}" ${scene.tracking[id]?'checked':''}><span>${label}</span></label>`;
$('#minimap-tracking-menu').innerHTML='<strong>Map tracking</strong>'+TRACKING_OPTIONS.slice(0,1).map(trackingCheckbox).join('')+'<details id="objective-tracking-types"><summary>Objective types</summary>'+OBJECTIVE_OPTIONS.map(trackingCheckbox).join('')+'</details><details open><summary>People & services</summary>'+TRACKING_OPTIONS.slice(1,7).map(trackingCheckbox).join('')+'</details><details open><summary>Resources & world</summary>'+TRACKING_OPTIONS.slice(7).map(trackingCheckbox).join('')+'</details><small>Quest numbers match your tracker. Filters are saved.</small>';

$('#minimap-tracking-button').onclick=e=>{e.stopPropagation();const open=$('#minimap-tracking-menu').classList.toggle('hidden')===false;$('#minimap-tracking-button').setAttribute('aria-expanded',String(open));};
$('#minimap-tracking-menu').onchange=e=>{const input=e.target.closest('[data-tracking]');if(!input)return;scene.setTracking(input.dataset.tracking,input.checked);scene.drawMap($('#minimap'));updateMapNavigation();if($('#zone-map'))scene.drawMap($('#zone-map'),true);};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.minimap-shell'))closeMapTracking();});
function updateMapNavigation(){
  const q=scene.questNavigation,root=$('#minimap-objective');root.classList.toggle('hidden',!q);if(!q){root.dataset.questId='';return;}
  root.dataset.questId=q.id;$('#minimap-quest-number').textContent=String(q.number);if($('#minimap-quest-title').textContent!==q.title)$('#minimap-quest-title').textContent=q.title;
  const guidance=`${q.objective} · ${q.progress}/${q.count}`;if($('#minimap-quest-guidance').textContent!==guidance)$('#minimap-quest-guidance').textContent=guidance;
  const p=scene.localPose||state.self,angle=Math.atan2(q.target.x-p.x,-(q.target.z-p.z)),arrow=['↑','↗','→','↘','↓','↙','←','↖'][(Math.round(angle/(Math.PI/4))+8)%8];
  $('#minimap-quest-distance').textContent=q.distance<2?'Here':`${arrow} ${Math.round(q.distance)}p`;
}
$('#minimap-quest-title').onclick=()=>{const id=scene.questNavigation?.id;if(!id)return;ui.journalFilter='active';ui.journalQuest=id;if(!ui.windows.get('journal'))ui.toggleJournal();else{ui.renderJournal();ui.windows.focus(ui.windows.get('journal'));}};
function mapHit(event){const r=$('#minimap').getBoundingClientRect();return scene.hitMinimap((event.clientX-r.left)*220/r.width,(event.clientY-r.top)*180/r.height);}
$('#minimap').removeAttribute('title');
$('#minimap').onpointermove=e=>{const hit=mapHit(e)||{title:'World map',detail:`Click to open the world map (${preferences.label('map')}). Scroll to zoom.`},tip=$('#map-marker-tooltip');tip.querySelector('strong').textContent=hit.title;tip.querySelector('span').textContent=hit.detail.replace('press F',`press ${preferences.label('interact')}`);tip.classList.remove('hidden');tip.style.left=`${Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,e.clientX-tip.offsetWidth-12))}px`;tip.style.top=`${Math.max(52,Math.min(innerHeight-tip.offsetHeight-10,e.clientY+12))}px`;};
$('#minimap').onpointerleave=()=>$('#map-marker-tooltip').classList.add('hidden');
$('#minimap').onclick=e=>{closeMapTracking();const hit=mapHit(e);if(hit?.kind==='quest'){const current=trackedQuest(state.self)?.id,index=hit.quests.indexOf(current),id=hit.quests[(index+1)%hit.quests.length];send({type:'trackQuest',id});}else ui.toggleMap();};



const developerEntry=location.pathname.replace(/\/$/,'')==='/developer';
const developerStorage={getItem:key=>preferenceStorage.getItem('developer:'+key),setItem:(key,value)=>preferenceStorage.setItem('developer:'+key,value),removeItem:key=>preferenceStorage.removeItem('developer:'+key)};
if(developerEntry){const badge=document.createElement('p');badge.className='eyebrow';badge.textContent='Game master explorer · All routes unlocked';document.querySelector('#join-form').prepend(badge);document.title+=' · Developer';}
const roster=new CharacterRoster({developer:developerEntry,storage:developerEntry?developerStorage:preferenceStorage,onEnter:(id)=>{applyPreferences(true);connect(id);}});
function connect(characterId=playing?session?.id:roster.selected?.id){
  if(joining||loggingOut)return;joining=true;$('#login-status').textContent='';$('#join').disabled=true;$('#login-error').textContent='';$('#disconnect-reason').textContent=`Connecting to ${UI_CONFIG.entryLabel||WORLD_INFO.name}…`;
  const connection=socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
  socket.onopen=()=>{if(socket===connection)send({type:'join',developer:developerEntry,accountToken:roster.token,characterId,worldId:WORLD_INFO.id,contentHash:WORLD_INFO.contentHash});};
  socket.onmessage=e=>{
    if(socket!==connection)return;
    let msg;try{msg=JSON.parse(e.data);}catch{return;}
    if(msg.type==='contentSync'||msg.type==='contentUpdate'){
      try{
        if(msg.type==='contentSync')applyLiveSnapshot(msg);
        else{if(msg.revision!==LIVE_CONTENT.revision+1)throw Error('Missed a world update. Reload to reconnect.');commitLivePatch(prepareLivePatch(msg.patch));}
        ui.signature='';if(ui.p){for(const id of ['dialogue','merchant','spellbook','journal'])if(ui.windows.get(id))ui[`render${id[0].toUpperCase()+id.slice(1)}`]?.();}
      }catch(error){$('#login-error').textContent=error.message;$('#disconnect-reason').textContent=error.message;socket.close(1000,'Reload world content');}
      return;
    }
    if(msg.type==='loggedOut'&&loggingOut){logoutAcknowledged=true;logoutSaved=msg.saved===true;return;}
    if(msg.type==='welcome'){
      try{applyLiveSnapshot(msg.liveContent);}catch(error){$('#login-error').textContent=error.message;socket.close(1000,'Reload world content');return;}
      selfId=msg.id;controls.reset();motion.reset();flight.reset();networkClock.reset();globalCooldown.reset();scene.resetNetwork();lastPing=0;lastMotionSend=0;lastMapDraw=0;fpsFrames=0;fpsStart=performance.now();casts.current=null;casts.epoch=null;casts.sequence=0;pendingTarget=null;pendingAuto=null;targetSequence=0;autoSequence=0;ui.loadCharacter(selfId);chatPanel.resume();session={id:msg.id,name:msg.name};
      keys.clear();control={x:0,z:0};questSignature='';menu.reset();playing=true;joining=false;$('#join').disabled=false;$('#login').classList.add('hidden');$('#hud').classList.remove('hidden');$('#disconnected').classList.add('hidden');
      scene.yaw=0;scene.pitch=.64;scene.zoom=15;currentArea='';lastOutdoorArea='';toast(msg.gameMaster?'Game master explorer. Open Travel to explore any destination.':`${UI_CONFIG.welcome||`Welcome to ${WORLD_INFO.name}.`} Speak to nearby people with gold quest markers (${preferences.label('interact')}).`,'good');
    }else if(msg.type==='state'){
      const now=performance.now(),reset=motion.pose&&msg.self.motionEpoch!==motion.epoch;networkClock.observe(msg.time,now);motion.reconcile(msg.self,now);flight.reconcile(msg.self,msg.time,now);casts.reconcile(msg.self,now,networkClock.time(now));globalCooldown.reconcile(msg.self,now,networkClock.time(now));
      if(reset||msg.self.hp<=0){controls.stop();pendingTarget=null;pendingAuto=null;}
      if(pendingTarget&&msg.self.targetSeq<pendingTarget.seq)msg.self.target=pendingTarget.id;else pendingTarget=null;
      if(pendingAuto&&msg.self.autoSeq<pendingAuto.seq)msg.self.auto=pendingAuto.enabled;else pendingAuto=null;
      state=msg;scene.setState(msg,selfId);updateHUD();
    }else if(msg.type==='pong')networkClock.pong(msg.clientTime,msg.serverTime,performance.now());
    else if(msg.type==='notice')toast(msg.text,msg.tone);
    else if(msg.type==='chatRejected')chatPanel.rejected(msg);
    else if(msg.type==='effect'){scene.effect(msg);if(msg.source===selfId||msg.target===selfId)sound(msg.kind);}
    else if(msg.type==='dialogue')ui.openDialogue(msg.npc);
    else if(msg.type==='loot')ui.openLoot(msg);
    else if(msg.type==='reading')ui.openReading(msg);
    else if(msg.type==='mailbox')correspondence.openMail(msg);
    else if(msg.type==='friends'){if(msg.add)correspondence.openAddFriend();else correspondence.toggleFriends();}
    else if(msg.type==='questComplete'){ui.questComplete(msg.id);sound('level');}
    else if(msg.type==='social'){scene.socialEvent(msg);addChat({text:msg.text,system:true,emote:true,ambient:msg.ambient});if(msg.speech)addChat({name:scene.entities.get(msg.source)?.data.name||'The grove',text:msg.speech,npcSpeech:true});}
    else if(msg.type==='chat'){addChat(msg);if(['say','yell'].includes(msg.channel))scene.speechEvent(msg.source,msg.text);}
    else if(msg.type==='error'){$('#login-error').textContent=msg.text;$('#disconnect-reason').textContent=msg.text;joining=false;$('#join').disabled=false;socket.close();}
  };
  socket.onclose=()=>{
    if(socket!==connection)return;socket=null;if(loggingOut){finishLogout();return;}menu.reset();
    joining=false;$('#join').disabled=false;controls.stop();keys.clear();stopCameraDrag();
    if(playing){$('#disconnected').classList.remove('hidden');if($('#disconnect-reason').textContent===`Connecting to ${UI_CONFIG.entryLabel||WORLD_INFO.name}…`)$('#disconnect-reason').textContent='Connection lost. Your journey is saved. Start the server if it is offline, then reconnect.';}
    else if(!$('#login-error').textContent)$('#login-error').textContent='Could not reach the game server. Start it and try again.';
  };
  socket.onerror=()=>{if(socket!==connection)return;joining=false;$('#join').disabled=false;};
}
$('#reconnect').onclick=()=>connect();
function toast(text,tone='info'){
  const el=document.createElement('div');el.className=`toast ${tone}`;el.textContent=text;$('#toasts').append(el);
  while($('#toasts').children.length>4)$('#toasts').firstChild.remove();setTimeout(()=>el.remove(),4800);
}
function addChat(msg){chatPanel.add(msg);}
function updateHUD(){
  const p=state.self;
  $('#player-name').textContent=p.name;$('#player-class').textContent=classDefinition(p.classId).name.toUpperCase();$('#energy-bar').style.background=classDefinition(p.classId).color;$('#level').textContent=p.level;$('#hp-bar').style.width=`${p.hp/p.maxHp*100}%`;$('#hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}${p.shield>0?` · ${Math.ceil(p.shield)} ward`:''}`;
  $('#energy-bar').style.width=`${p.energy}%`;$('#energy-text').textContent=`${Math.floor(p.energy)} / 100 ${classDefinition(p.classId).resource.toUpperCase()}`;
  $('#online').textContent=`${state.players.length} adventurer${state.players.length===1?'':'s'} online`;
  $('#coords').textContent=`${Math.round(p.x)}, ${Math.round(p.z)}`;
  const enemy=state.enemies.find(e=>e.id===p.target),target=enemy||state.players.find(v=>v.id===p.target)||(state.npcs||[]).find(v=>v.id===p.target);
  $('#target-frame').classList.toggle('hidden',!target);$('#target-frame').classList.toggle('friendly',!!target&&(!enemy||enemy.friendly));
  if(target){
    $('#target-enemy-icon').classList.toggle('hidden',!enemy);$('#target-friendly-icon').classList.toggle('hidden',!!enemy);
    const def=enemy?ENEMY_TYPES[target.type]:target,maximum=enemy?def.hp:target.maxHp,range=dist(p,target);$('#target-frame').dataset.unitId=target.id;
    $('#target-name').textContent=def.name;$('#target-level').textContent=def.level;$('#target-distance').textContent=`${range.toFixed(0)} PACES`;
    $('#target-hp').style.width=`${target.hp/maximum*100}%`;$('#target-hp-text').textContent=`${Math.ceil(target.hp)} / ${maximum}`;
    $('#target-status').textContent=enemy?(target.hp<=0?(target.lootable?'Loot: approach and press F':'Defeated'):target.friendly?'Peaceful toward you · /soothe builds trust':target.slamAt>state.time?'⚠ Move out of the red circle!':range<=classDefinition(p.classId).autoRange?'Right-click: auto attack':'Enemy · Select a skill to attack'):target.hp<=0?'Fallen':target.id===selfId?`Your character · ${SKILLS[skillForRole(p,'heal')].name} heals you`:state.players.some(v=>v.id===target.id)?`Friendly player · ${SKILLS[skillForRole(p,'heal')].name} to heal`:`${target.title} · ${preferences.label('interact')} to talk`;
    $('#target-status').classList.toggle('boss-warning',!!enemy&&target.slamAt>state.time);
    const inParty=state.party?.members.includes(target.id),leader=!state.party||state.party.leader===selfId;
    $('#target-invite').classList.toggle('hidden',!!enemy||!state.players.some(v=>v.id===target.id)||target.id===selfId||!!inParty||!leader||(state.party?.members.length||0)>=5);
    $('#target-invite').onclick=e=>{e.stopPropagation();send({type:'party',action:'invite',id:target.id});};
  }
  renderParty();correspondence.update();
  const next=LEVEL_XP[p.level+1],base=LEVEL_XP[p.level];$('#xp-bar').style.width=p.level>=LIVE_LEVEL_CAP?'100%':`${(p.xp-base)/(next-base)*100}%`;$('#xp-text').textContent=p.level>=LIVE_LEVEL_CAP?`LEVEL ${LIVE_LEVEL_CAP} · STARTER ZONE LEVEL CAP`:`${p.xp-base} / ${next-base} XP · LEVEL ${p.level}`;
  const zoneLabel=(UI_CONFIG.zoneLabels?.[p.mapId]||WORLD_INFO.zoneNames[p.mapId]||UI_CONFIG.region||WORLD_INFO.name).toUpperCase();$('.minimap-heading>span').textContent=zoneLabel;$('#location-announcement small').textContent=zoneLabel;
  $('#death').classList.toggle('hidden',p.hp>0);$('#respawn').disabled=p.respawnIn>0;$('#respawn').textContent=p.respawnIn>0?`Return in ${Math.ceil(p.respawnIn)}…`:'Return to your rest point';
  const qs=JSON.stringify([p.quests,p.trackedQuest,p.level]);if(qs!==questSignature){questSignature=qs;renderTracker();}
  const building=buildingAt(p.x,p.z),area=building?{name:building.name,subtitle:building.subtitle}:LANDMARKS.reduce((a,b)=>dist(p,a)<dist(p,b)?a:b);if(area.name!==currentArea){currentArea=area.name;$('#area').textContent=area.name.toUpperCase();if(building){clearTimeout(announceTimer);$('#location-announcement').style.opacity='0';}else if(area.name!==lastOutdoorArea){lastOutdoorArea=area.name;announce(area);}}
  updateNearby();ui.update();
}
function renderParty(){
  const roster=$('#party-members'),members=state.party?.members.filter(id=>id!==selfId)||[],key=members.join('|');
  $('#party-frame').classList.toggle('hidden',!members.length);
  if(roster.dataset.members!==key){roster.dataset.members=key;roster.replaceChildren();for(const id of members){const button=document.createElement('button');button.className='party-member';button.dataset.unitId=id;button.innerHTML='<span class="party-name"></span><small></small><div class="party-health"><i></i><span></span></div>';button.onclick=()=>send({type:'target',id});roster.append(button);}}
  for(const button of roster.children){const unit=state.players.find(p=>p.id===button.dataset.unitId)||state.party?.units?.find(p=>p.id===button.dataset.unitId);if(!unit)continue;button.classList.toggle('selected',state.self.target===unit.id);button.querySelector('.party-name').textContent=unit.name;button.querySelector('small').textContent=`${unit.level} · ${state.party.leader===unit.id?'Leader':classDefinition(unit.classId).name}`;button.querySelector('i').style.width=`${unit.hp/unit.maxHp*100}%`;button.querySelector('.party-health span').textContent=unit.hp<=0?'Fallen':`${Math.ceil(unit.hp)} / ${unit.maxHp}`;}
  const invite=state.partyInvite;$('#party-invitation').classList.toggle('hidden',!invite);if(invite)$('#party-invitation-name').textContent=`${invite.name} invites you to a party`;
}
$('#player-frame').onclick=()=>send({type:'target',id:selfId});
$('#party-leave').onclick=()=>send({type:'party',action:'leave'});
$('#party-accept').onclick=()=>send({type:'party',action:'accept'});
$('#party-decline').onclick=()=>send({type:'party',action:'decline'});
function announce(area){clearTimeout(announceTimer);const el=$('#location-announcement');el.querySelector('strong').textContent=area.name;el.querySelector('span').textContent=area.subtitle;el.style.opacity='1';announceTimer=setTimeout(()=>el.style.opacity='0',4200);}
function renderTracker(){
  if(!state)return;const p=state.self,quests=activeQuests(p),tracked=trackedQuest(p),completed=QUESTS.filter(q=>questDone(p,q)).length;
  $('#quest-content').innerHTML=quests.length?(tracked?[tracked,...quests.filter(q=>q.id!==tracked.id)]:quests).slice(0,5).map(q=>{const r=questRecord(p,q),done=questReady(p,q);return `<div class="tracked-entry ${tracked?.id===q.id?'selected':''}" data-track="${q.id}"><h3><span class="quest-number">${quests.findIndex(item=>item.id===q.id)+1}</span>${q.title}</h3><div class="objective"><span>${done?'✦':'◇'}</span><span>${done?`Return to ${NPCS.find(n=>n.id===q.turnIn).name}`:q.objective}</span>${!done?`<b>${r.progress}/${q.count}</b>`:''}</div></div>`;}).join(''):`<h3>${trackerEmpty(p).title}</h3><p>${trackerEmpty(p).text}</p>`;
  $('#quest-content').innerHTML+=`<div class="quest-steps">${completed}/${QUESTS.filter(q=>!q.classId||q.classId===p.classId).length} QUESTS COMPLETE · ${quests.length} ACTIVE</div><button class="tracker-button" id="tracker-map">Map →</button> &nbsp; <button class="tracker-button" id="tracker-journal">Journal →</button>`;
  $('#tracker-map').onclick=()=>ui.toggleMap();$('#tracker-journal').onclick=()=>ui.toggleJournal();$('#quest-content').querySelectorAll('[data-track]').forEach(el=>el.onclick=()=>send({type:'trackQuest',id:el.dataset.track}));
}
function updateNearby(){
  if(!state||state.self.hp<=0){nearby=null;$('#interaction').classList.add('hidden');return;}
  const p=state.self;
  const options=[...MAILBOXES,...(state.npcs||[]),...READABLES.filter(r=>readableAvailable(p,r)),...GATHERABLES.filter(g=>RESOURCE_TYPES[g.type]?!(p.harvestCooldowns?.[g.id]>0):activeQuests(p).some(q=>q.kind==='gather'&&q.target===g.type&&!questRecord(p,q).gathered.includes(g.id)&&!questReady(p,q))),...state.enemies.filter(e=>e.hp<=0&&e.lootable)];
  nearby=options.filter(o=>dist(p,o)<=4.8).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  $('#interaction').classList.toggle('hidden',!nearby||!!ui.windows.get('dialogue')||!!ui.windows.get('loot')||!!ui.windows.get('reading')||!!ui.windows.get('mail'));
  if(nearby)$('#interaction span').textContent=nearby.type==='mailbox'?`Open ${nearby.name}`:nearby.storyId?`Read ${nearby.title}`:nearby.role?`Speak to ${nearby.name}`:ENEMY_TYPES[nearby.type]?`Loot ${ENEMY_TYPES[nearby.type].name}`:({cache:'Recover supply crate',beacon:'Rekindle ancient beacon',herb:'Gather sunmint',ore:'Mine copper seam',track:'Examine root trace',ledger:'Recover courier’s journal',sap:'Gather living amber',page:'Read memorial tablet'}[nearby.type]||`Recover ${nearby.name||'keepsake'}`);
}
$('#respawn').onclick=()=>send({type:'respawn'});
function cycleTarget(){
  const p=state.self,targets=state.enemies.filter(e=>e.hp>0&&dist(p,e)<30).sort((a,b)=>dist(p,a)-dist(p,b));if(!targets.length)return toast('No enemies nearby.');const current=targets.findIndex(e=>e.id===p.target);send({type:'target',id:targets[(current+1)%targets.length].id});
}
function openEmoteBook(){ui.spellTab='emotes';if(!ui.windows.get('spellbook'))ui.toggleSpellbook();else{ui.renderSpellbook();ui.windows.focus(ui.windows.get('spellbook'));}}
const socialChat=new SocialChat({persistent:true,input:$('#chat-input'),list:$('#chat-suggestions'),channelSelect:$('#chat-channel'),getPlayer:()=>state?.self,onSend:(text,channel)=>send({type:'chat',text,channel,audience:ui.emoteAudience}),onBook:openEmoteBook,onOpen:()=>{controls.stop();stopCameraDrag();keys.clear();send({type:'input',x:0,z:0});}});
const chatPanel=new ChatPanel({chat:socialChat,getState:()=>state,send:(text,channel,whisperTo)=>send({type:'chat',text,channel,...(whisperTo?{whisperTo}:{}),audience:ui.emoteAudience}),onOpen:()=>{controls.stop();stopCameraDrag();keys.clear();send({type:'input',x:0,z:0});}});
function chatFocus(prefix){socialChat.open(prefix);}
$('#chat-emotes-button').onclick=openEmoteBook;
const correspondence=new CorrespondenceUI({ui,send,getState:()=>state,whisper:name=>chatPanel.startWhisper(name)});
$('#friends-button').onclick=()=>correspondence.toggleFriends();
$('#target-frame .portrait').oncontextmenu=e=>{e.preventDefault();const target=state?.players.find(v=>v.id===state.self.target);if(target&&target.id!==selfId)correspondence.contextMenu(target,e.clientX,e.clientY);};
function updateControlHint(){
  const text=controls.autorun?`Autorun · ${preferences.label('forward')} or ${preferences.label('autorun')} to stop`:`${preferences.label('jump')} jump · ${preferences.label('autorun')} autorun · Right-click enemy to attack · ${preferences.label('interact')} interact`;
  if(text!==controlHint){controlHint=text;$('#action-hint').textContent=text;$('#action-hint').classList.toggle('autorun-active',controls.autorun);}
}
function useBoundAction(action,event={}){
  if(action==='autorun'){if(state?.self.hp>0)controls.toggleAutorun();updateControlHint();return;}
  if(action==='forward'||action==='backward')controls.manualForward();
  if(action==='chat'){chatFocus();return;}
  if(action==='target'){cycleTarget();return;}
  if(action==='jump'){send({type:'jump'});return;}
  if(action==='interact'){ui.interact(nearby?.id,event.shiftKey);return;}
  const windows={bags:'toggleBags',character:'toggleCharacter',spellbook:'toggleSpellbook',journal:'toggleJournal',map:'toggleMap',help:'toggleHelp'};
  if(windows[action]){ui[windows[action]]();return;}
  if(action?.startsWith('action'))ui.activateSlot(Number(action.slice(6))-1);
}
const editing=e=>e.target?.closest?.('textarea,select,input:not([type="checkbox"]):not([type="range"]):not([type="radio"])')||e.target?.isContentEditable;
window.addEventListener('keydown',e=>{
  if(menu.handleKeyDown(e))return;
  if(e.code==='Escape'&&!$('#minimap-tracking-menu').classList.contains('hidden')){closeMapTracking();e.preventDefault();return;}
  if(!playing||!state||editing(e))return;
  if(e.key==='/'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();if(!e.repeat)chatFocus('/');return;}
  if(e.code==='Escape'){e.preventDefault();if(e.repeat)return;if(cameraMouse.locked||cameraMouse.pending){controls.autorun=false;keys.clear();stopCameraDrag();updateControlHint();return;}stopCameraDrag();if(casts.current)cancelCasting();else if(ui.windows.closeTop()){}else if(state.self.target&&socket?.readyState===WebSocket.OPEN)send({type:'target',id:null});else menu.open();return;}
  if(loggingOut||socket?.readyState!==WebSocket.OPEN)return;
  keys.add(e.code);const action=preferences.actionForEvent(e);if(action||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat||!action)return;
  if(action==='interact'){ui.interact(nearby?.id,e.shiftKey);return;}useBoundAction(action,e);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function clearControls(){controls.stop();keys.clear();stopCameraDrag();send({type:'input',x:0,z:0});updateControlHint();}
window.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});
function updateMouseCursor(){document.body.classList.toggle('camera-dragging',!!cameraMouse?.locked&&controls.buttons.size>0);}
function releaseCameraCapture(){if(cameraPointerId!==null){const id=cameraPointerId;cameraPointerId=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}}
function stopCameraDrag(){$('#world-sign-tooltip').classList.add('hidden');controls.clearMouse();cameraMouse.release();updateMouseCursor();releaseCameraCapture();}
const canvas=$('#world');
const cameraMouse=new CameraPointerLock(canvas,{
 onMove:point=>moveCamera(point.x,point.y),onChange:updateMouseCursor,
 onLost:()=>{controls.stop();keys.clear();control={x:0,z:0};releaseCameraCapture();updateControlHint();},
 onError:()=>{toast('Mouse capture was blocked. Allow pointer lock for this site to confine the camera cursor.');}
});
canvas.oncontextmenu=e=>e.preventDefault();
function mouseButtonDown(e){$('#world-sign-tooltip').classList.add('hidden');
  if(![0,2].includes(e.button)||!playing||menu.visible||loggingOut)return;
  const point=cameraMouse.coordinates(e);controls.mouseDown(e.button,point.x,point.y);if(e.button===2)cameraMouse.request(point.x,point.y);if(controls.buttons.has(2))controls.heading=scene.yaw+Math.PI;updateMouseCursor();
}
canvas.onpointerdown=e=>{if([0,2].includes(e.button)&&playing&&!menu.visible&&!loggingOut){mouseButtonDown(e);if(!cameraMouse.locked){cameraPointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);}}};
// Pointer events report only the first/last mouse button in a chord. Compatibility
// mouse events report each additional press/release, including right-first chords.
canvas.onmousedown=e=>{if([0,2].includes(e.button)){mouseButtonDown(e);e.preventDefault();}};
function moveCamera(x,y){
  const delta=controls.mouseMove(x,y);
  if(delta&&!cameraMouse.locked&&!cameraMouse.pending)cameraMouse.request(x,y);
  if(delta&&cameraMouse.locked){scene.yaw-=delta.x*.006*preferences.settings.cameraSensitivity;scene.pitch=clampCameraPitch(scene.pitch+delta.y*.004*preferences.settings.cameraSensitivity);if(controls.buttons.has(2))controls.heading=scene.yaw+Math.PI;}
  updateMouseCursor();
}
let lastSignHover=0;
canvas.onpointermove=e=>{if(!cameraMouse.locked)moveCamera(e.clientX,e.clientY);const tip=$('#world-sign-tooltip');if(!playing||controls.buttons.size||cameraMouse.locked){tip.classList.add('hidden');return;}if(performance.now()-lastSignHover<80)return;lastSignHover=performance.now();const hit=scene.pick(e.clientX,e.clientY);canvas.style.cursor=hit?.kind==='readable'||hit?.kind==='mailbox'||hit?.kind==='gather'&&gatherAvailable(state?.self,GATHERABLES.find(g=>g.id===hit.id))?'pointer':'default';if(!['sign','readable','mailbox'].includes(hit?.kind)){tip.classList.add('hidden');return;}tip.querySelector('strong').textContent=hit.kind==='mailbox'?hit.mailbox.name:hit.kind==='readable'?hit.reading.title:hit.sign.name;tip.querySelector('span').textContent=hit.kind==='mailbox'?'Town post · Send letters and items, even to offline adventurers.':hit.kind==='readable'?`${hit.reading.author} · Click to read nearby`:hit.sign.destinations.map(d=>`${roadDirection(hit.sign,d)} → ${d.name}`).join('\n');tip.classList.remove('hidden');tip.style.left=`${Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,e.clientX+18))}px`;tip.style.top=`${Math.max(52,Math.min(innerHeight-tip.offsetHeight-8,e.clientY+18))}px`;};
canvas.addEventListener('pointerleave',()=>{canvas.style.cursor='default';$('#world-sign-tooltip').classList.add('hidden');});
function mouseButtonUp(e){
  if([1,3,4].includes(e.button)){keys.delete(`Mouse${e.button}`);if(playing||menu.visible)e.preventDefault();return;}
  const point=cameraMouse.coordinates(e),result=controls.mouseUp(e.button,point.x,point.y);if(!result)return;
  if(!controls.buttons.size){cameraMouse.release();releaseCameraCapture();}updateMouseCursor();
  if(!result.clicked||!playing||menu.visible||loggingOut)return;
  const hit=scene.pick(point.x,point.y);
  if(e.button===2){
    if(hit?.kind==='enemy'&&state.enemies.find(enemy=>enemy.id===hit.id)?.hp>0){send({type:'target',id:hit.id,passive:false});send({type:'auto',enabled:true});}
    else if(hit?.kind==='player')send({type:'target',id:hit.id});else if(hit&&hit.kind!=='sign'){if(hit.kind==='npc')send({type:'target',id:hit.id});ui.interact(hit.id,e.shiftKey);}
  }else if(e.button===0){if(hit&&['enemy','player','npc'].includes(hit.kind))send({type:'target',id:hit.id});else if(hit&&hit.kind!=='sign')ui.interact(hit.id,e.shiftKey);else send({type:'target',id:null});}
}
window.addEventListener('pointerup',mouseButtonUp,true);window.addEventListener('mouseup',mouseButtonUp,true);
function extraMouseDown(e){
  if(![1,3,4].includes(e.button))return;
  if(playing||menu.visible)e.preventDefault();if(menu.handlePointerDown(e))return;
  if(!playing||!state||loggingOut||editing(e)||socket?.readyState!==WebSocket.OPEN)return;
  const code=`Mouse${e.button}`;if(keys.has(code))return;keys.add(code);const action=preferences.actionForEvent(e);if(action)useBoundAction(action,e);
}
window.addEventListener('pointerdown',extraMouseDown,true);window.addEventListener('mousedown',extraMouseDown,true);
window.addEventListener('auxclick',e=>{if([1,3,4].includes(e.button)&&(playing||menu.visible))e.preventDefault();},true);
canvas.onpointercancel=stopCameraDrag;canvas.onlostpointercapture=()=>{cameraPointerId=null;if(cameraMouse.pending||cameraMouse.locked)return;stopCameraDrag();};
canvas.addEventListener('wheel',e=>{e.preventDefault();if(playing&&!menu.visible&&!loggingOut)scene.zoom=Math.max(7,Math.min(28,scene.zoom+e.deltaY*.012));},{passive:false});

$('#audio-button').onclick=()=>{preferences.set('sound',!preferences.settings.sound);applyPreferences(true);};
function sound(kind){
  if(!audioEnabled||!audio||performance.now()-lastSound<90)return;lastSound=performance.now();
  const good=['heal','level','gather'].includes(kind),osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  osc.type=good?'sine':'triangle';osc.frequency.setValueAtTime(kind==='level'?523:good?392:180,now);osc.frequency.exponentialRampToValueAtTime(good?784:70,now+.18);gain.gain.setValueAtTime(.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+.25);osc.connect(gain);gain.connect(audioMaster);osc.start();osc.stop(now+.28);
}
let previous=performance.now(),lastWindowPose=null,lastWindowMovement=-1000;
function frame(now){
  const dt=Math.min(.25,(now-previous)/1000);previous=now;
  if(playing&&state){
    const intent=controls.update(dt,scene.yaw,action=>preferences.held(action,keys),!menu.visible&&!loggingOut&&socket?.readyState===WebSocket.OPEN&&!editing({target:document.activeElement})&&state.self.hp>0&&!state.self.transit);
    scene.yaw=intent.cameraYaw;const{x,z,facing}=intent;control={x,z};updateControlHint();if(x||z)cancelCasting();
    if(state.self.hp>0&&!state.self.transit)motion.advance(dt,x,z,now,facing);
    if(!state.self.transit&&now-lastMotionSend>=50){motion.flush(sendRaw);lastMotionSend=now;}
    if(now-lastPing>=2000){sendRaw({type:'ping',clientTime:now});lastPing=now;}
    const presentation=flight.visual(state.self,now,networkClock.time(now))||motion.visual();
    const windowPose=presentation;if(lastWindowPose&&Math.hypot(windowPose.x-lastWindowPose.x,windowPose.z-lastWindowPose.z,(windowPose.y||0)-(lastWindowPose.y||0))>.001)lastWindowMovement=now;lastWindowPose=windowPose;ui.setMoving(now-lastWindowMovement<150);
    scene.setPresentation(presentation,networkClock.time(now),casts.current);
    ui.updateCast(casts.current,casts.progress(now),now);ui.updateBar();
    if(now-lastMapDraw>=50){scene.drawMap($('#minimap'));if(ui.windows.get('map'))scene.drawMap($('#zone-map'),true);updateMapNavigation();lastMapDraw=now;}
    fpsFrames++;if(now-fpsStart>=1000){$('#net-stats').textContent=`${networkClock.rtt===null?'—':Math.round(networkClock.rtt)} ms · ${Math.round(fpsFrames*1000/(now-fpsStart))} FPS`;fpsFrames=0;fpsStart=now;}

  }
  scene.frame(Math.min(.05,dt),now/1000,playing);roster.frame(Math.min(.05,dt));requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

export {ui,scene,roster,preferences,send};
