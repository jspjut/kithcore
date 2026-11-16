import * as THREE from 'three';
import {storageKey} from '../shared/world-storage.js';
import {ACTOR_FADE_START,ACTOR_VIEW_DISTANCE} from '/shared/zone-regions.js';
import {WORLD_BOUNDS,ZONE_BOUNDS,SPAWN} from '/shared/zone-layout.js';
import {MAILBOXES} from '/shared/mail.js';
import {READABLES,readableAvailable} from '/shared/readables.js';
import {EMOTES} from '/shared/social.js';
import {cameraOrbit} from './camera-look.js';
import {classDefinition,raceDefinition} from '/shared/adventurers.js';
import {GroundArea} from './ground-area.js';
import {overheadHealthBar} from './nameplate-health.js';
import {TargetMarker} from './target-marker.js';
import {drawAtlas} from './cartography.js';
import {supportBelow} from '/shared/props.js';
import {createHumanoid,animateHumanoid,disposeHumanoid} from './character.js';
import {SnapshotInterpolator} from './netcode.js';
import {MAP_RADII,DEFAULT_MAP_ZOOM,clampZoom,mapView,mapPoint,edgePoint,trackingSettings,trackingMarkers,questOverlays,questTooltip} from './minimap.js';
import {SKILLS,heightAt,NPCS,GATHERABLES,RESOURCE_TYPES,ENEMY_TYPES,BUILDINGS,LANDMARKS,questRecord,questReady,questDone,npcQuests,trackedQuest,questDestination} from '/shared/content.js';
import {rand,material,mesh,box,ball,cylinder,beam} from './scene-primitives.js';
import {worldPresentation} from './world-presentation.js';
import {UI_CONFIG,showQuestRing} from './world-ui.js';

export class GameScene {
  constructor(canvas) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#a8c4ad');this.scene.fog=new THREE.FogExp2('#b0c5ad',.012);
    this.scene.add(new THREE.HemisphereLight(0xffedcf,0x526a56,1.8));
    this.sun=new THREE.DirectionalLight(0xffdca0,2.5);this.sun.position.set(-35,60,15);this.sun.castShadow=true;
    Object.assign(this.sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:150});this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.001;this.sun.shadow.normalBias=.035;this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.camera=new THREE.PerspectiveCamera(48,1,.1,240);this.yaw=0;this.pitch=.64;this.zoom=15;
    this.focus=new THREE.Vector3(0,2,26);this.entities=new Map();this.gathers=new Map();this.effects=[];this.state=null;
    this.windUniforms=[];this.raycaster=new THREE.Raycaster();this.mouse=new THREE.Vector2();this.vector=new THREE.Vector3();
    this.timeline=new SnapshotInterpolator();this.localPose=null;this.serverTime=0;this.lastForestUpdate=-1;this.lastShadowUpdate=-1;this.zeroMatrix=new THREE.Matrix4().makeScale(0,0,0);
    this.tracking=trackingSettings();this.minimapHits=[];this.questNavigation=null;try{this.tracking=trackingSettings(JSON.parse(localStorage.getItem(storageKey('minimap-tracking'))));}catch{}
    this.mapZoomIndex=DEFAULT_MAP_ZOOM;try{const saved=localStorage.getItem(storageKey('minimap-zoom'));if(saved!==null)this.mapZoomIndex=clampZoom(Number(saved));}catch{}
    this.signs=new Map();this.waypointMarkers=[];
    this.buildWorld();
    this.selection=new TargetMarker();this.scene.add(this.selection.root);
    this.questRing=new GroundArea({...(UI_CONFIG.questRing||{x:0,z:8}),radius:2.38,innerRatio:2.3/2.38,color:0xffda8d,opacity:.3});this.scene.add(this.questRing);
    this.resize();window.addEventListener('resize',()=>this.resize());
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
  addNPC(npc){const o=this.humanoid(npc.color,npc.featured?false:npc.raceId?false:true,npc.look,npc.appearance,npc.raceId);if(npc.raceId)o.userData.equipment.update(npc.equipment||{armor:classDefinition(npc.classId).starterArmor});if(npc.scale)o.scale.setScalar(npc.scale);o.position.set(npc.x,heightAt(npc.x,npc.z),npc.z);o.rotation.y=npc.facing??Math.atan2(SPAWN.x-npc.x,SPAWN.z-npc.z);this.scene.add(o);const e={object:o,data:npc,kind:'npc',label:this.label('npc',npc.id)};this.entities.set(npc.id,e);return e;}
  humanoid(color,npc=false,look,appearance,raceId){return createHumanoid(color,npc,look,appearance,{},raceId);}
  fadeActor(e,opacity){
    if(opacity<1){e.fadeMaterials||=[];e.object.traverse(o=>{if(!o.isMesh||o.userData.actorFade)return;o.userData.actorFade=true;const clone=m=>{const c=m.clone();e.fadeMaterials.push({material:c,transparent:m.transparent,depthWrite:m.depthWrite});return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});}
    for(const entry of e.fadeMaterials||[]){entry.material.opacity=opacity;entry.material.transparent=opacity<1||entry.transparent;entry.material.depthWrite=opacity>=1&&entry.depthWrite;}
  }
  animateCharacter(o,pose,dt,options){animateHumanoid(o,pose,dt,options,(x,z)=>supportBelow(x,z,(pose.y??heightAt(pose.x,pose.z))+.02,0).y);}
  label(kind,id){const el=document.createElement('div');el.className=`nameplate ${kind}`;el.dataset.unitId=id;document.querySelector('#labels').append(el);return el;}
  setState(state,id){
    this.state=state;this.selfId=id;this.timeline.push(state);
    const live=new Set();for(const npc of state.npcs||[]){live.add(npc.id);let e=this.entities.get(npc.id);if(!e)e=this.addNPC({...NPCS.find(n=>n.id===npc.id),...npc});e.data={...e.data,...npc};}
    for(const data of [...state.players,...state.enemies]){
      live.add(data.id);let ent=this.entities.get(data.id);const kind=data.type?'enemy':'player';
      if(!ent){const o=kind==='enemy'?this.creature(ENEMY_TYPES[data.type].appearanceType||data.type,ENEMY_TYPES[data.type]):this.humanoid('#a5b6a2',false,data.look,data.appearance,data.raceId);o.position.set(data.x,heightAt(data.x,data.z),data.z);this.scene.add(o);ent={object:o,data,kind,label:this.label(kind,data.id),lastX:data.x,lastZ:data.z};this.entities.set(data.id,ent);}
      if(kind==='player'){const key=JSON.stringify([data.look,data.appearance,data.raceId]);if(ent.appearanceKey&&ent.appearanceKey!==key){const old=ent.object;ent.object=this.humanoid('#a5b6a2',false,data.look,data.appearance,data.raceId);ent.object.position.copy(old.position);ent.object.rotation.copy(old.rotation);disposeHumanoid(old);this.scene.add(ent.object);}ent.appearanceKey=key;}
      ent.data=data;
      if(kind==='player')ent.object.userData.equipment.update(data.id===id?state.self.equipment:data.equipment);
    }
    for(const [key,e] of this.entities)if(!live.has(key)){this.removeEntity(e);this.entities.delete(key);}
    for(const [key,g] of this.gathers){const done=Object.values(state.self.quests).some(q=>q.gathered.includes(key));g.object.visible=g.data.storyId?readableAvailable(state.self,g.data):g.data.type==='cache'||g.data.type==='mailbox'?true:RESOURCE_TYPES[g.data.type]?!(state.self.harvestCooldowns?.[key]>0):!done||g.data.type==='beacon';if(g.object.userData.flame)g.object.userData.flame.visible=done;}
  }
  setPresentation(pose,serverTime,casting=null){this.localPose=pose;this.serverTime=serverTime;this.localCasting=casting;}
  nameplateAnchor(entity){const o=entity.object,d=entity.data;return {x:o.position.x,y:o.position.y+(entity.kind==='enemy'?(ENEMY_TYPES[d.type].nameplateHeight??(ENEMY_TYPES[d.type].level>3?3.2:1.7)):(raceDefinition(d.raceId).nameplateHeight??2.6)*(d.scale||1)),z:o.position.z};}
  signDebug(){return [...this.signs.values()].map(e=>({id:e.data.id,screen:this.project(e.data.x,heightAt(e.data.x,e.data.z)+2.3,e.data.z),postScreen:this.project(e.data.x,heightAt(e.data.x,e.data.z)+.7,e.data.z),boards:e.object.children.filter(o=>o.userData.signDestination).map(o=>{const p=new THREE.Vector3(0,0,.65).applyMatrix4(o.matrixWorld);return {name:o.userData.signDestination.name,screen:this.project(p.x,p.y,p.z)};})}));}
  groundAreaDebug(){return [...this.entities].filter(([,e])=>e.warning?.visible).map(([id,e])=>({id,type:e.data.type,...e.warning.debug()}));}
  unitDebug(){return [...this.entities].map(([id,e])=>{const anchor=this.nameplateAnchor(e);return {id,kind:e.kind,visible:e.object.visible,x:e.object.position.x,z:e.object.position.z,worldY:e.object.position.y,appearance:e.object.userData.appearance,screen:this.project(e.object.position.x,e.object.position.y+(e.kind==='enemy'?.7:1.2),e.object.position.z),nameplate:this.project(anchor.x,anchor.y,anchor.z),equipment:e.object.userData.equipment?.debug(),emote:e.data.emote,emotePose:!!e.object.userData.emotePose,animation:e.object.userData.animation?{phase:e.object.userData.animation.phase,speed:e.object.userData.animation.speed,blend:e.object.userData.animation.blend,move:e.object.userData.animation.move,attack:e.object.userData.animation.attack}:null};});}

  characterDebug(){
    const o=this.entities.get(this.selfId)?.object,a=o?.userData.animation;if(!a)return null;
    const support=supportBelow(o.position.x,o.position.z,o.position.y+.03);
    const heading=part=>{const direction=new THREE.Vector3(0,0,1).applyQuaternion(part.getWorldQuaternion(new THREE.Quaternion()));return Math.atan2(direction.x,direction.z);};
    return {ground:support.y,terrain:heightAt(o.position.x,o.position.z),supportId:this.localPose?.supportId,grounded:this.localPose?.grounded,worldY:o.position.y,speed:a.speed,phase:a.phase,blend:a.blend,air:a.air,facing:a.facing,lowerFacing:heading(o.userData.rig.lowerBody),torsoFacing:heading(o.userData.rig.torso),headFacing:heading(o.userData.rig.head),lowerYaw:a.lowerYaw,backpedal:a.backpedal,gaitDirection:a.gaitDirection,cameraClearance:this.camera.position.y-heightAt(this.camera.position.x,this.camera.position.z),
      feet:o.userData.rig.legs.map(leg=>{const v=leg.ankle.getWorldPosition(new THREE.Vector3());return {x:v.x,y:v.y,z:v.z,ground:supportBelow(v.x,v.z,o.position.y+.03,0).y};})};
  }
  applyPreferences(settings){
    this.ambientMotion=settings.ambientMotion;
    if(this.quality===settings.quality)return;this.quality=settings.quality;
    const cap={low:1,balanced:1.5,high:2}[settings.quality]||1.5;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,cap));this.renderer.shadowMap.enabled=settings.quality!=='low';this.renderer.shadowMap.needsUpdate=true;
    this.scene.traverse(o=>{if(o.material)for(const material of (Array.isArray(o.material)?o.material:[o.material]))material.needsUpdate=true;});this.resize();
  }
  removeEntity(e){
    // Detach cached equipment first; only the character's own meshes are freed.
    disposeHumanoid(e.object);for(const entry of e.fadeMaterials||[])entry.material.dispose();e.label.remove();e.reaction?.remove();e.bubble?.remove();
    if(e.warning){this.scene.remove(e.warning);e.warning.geometry.dispose();e.warning.material.dispose();}
  }
  resetSession(){
    this.state=null;this.selfId=null;this.localCasting=null;this.playCamera=false;this.resetNetwork();
    for(const e of this.entities.values()){e.reaction?.remove();e.reaction=null;e.bubble?.remove();e.bubble=null;e.speech=null;}for(const [id,e]of this.entities)if(e.kind!=='npc'){this.removeEntity(e);this.entities.delete(id);}
    for(const effect of this.effects)this.disposeEffect(effect);this.effects=[];
    this.minimapHits=[];this.mapQuestRegions=[];this.mapQuestOverlays=[];this.questNavigation=null;
  }
  disposeEffect(effect){this.scene.remove(effect.object);effect.object.traverse(node=>node.geometry?.dispose());if(!effect.projectile)effect.object.material?.dispose();}
  resetNetwork(){this.timeline=new SnapshotInterpolator();this.localPose=null;this.serverTime=0;}
  zoomMinimap(delta){this.mapZoomIndex=clampZoom(this.mapZoomIndex+delta);try{localStorage.setItem(storageKey('minimap-zoom'),String(this.mapZoomIndex));}catch{}return MAP_RADII[this.mapZoomIndex];}
  setTracking(id,value){if(!Object.hasOwn(this.tracking,id))return;this.tracking[id]=value===true;try{localStorage.setItem(storageKey('minimap-tracking'),JSON.stringify(this.tracking));}catch{}}
  hitMinimap(x,y){
    const hit=[...this.minimapHits].reverse().find(hit=>Math.hypot(hit.x-x,hit.y-y)<=hit.radius),regions=(this.mapQuestRegions||[]).filter(r=>Math.hypot(r.x-x,r.y-y)<=r.radius);
    if(hit?.kind==='quest'||regions.length){const ids=new Set(hit?.kind==='quest'?hit.quests:regions.map(r=>r.quest.id)),quests=(this.mapQuestOverlays||[]).filter(q=>ids.has(q.id));return {...(hit?.kind==='quest'?hit:{kind:'questArea'}),quests:quests.map(q=>q.id),...questTooltip(quests,hit?.kind==='quest')};}
    return hit||null;
  }
  project(x,y,z){this.vector.set(x,y,z).project(this.camera);return {x:(this.vector.x*.5+.5)*innerWidth,y:(-.5*this.vector.y+.5)*innerHeight,visible:this.vector.z<1&&this.vector.z>-1};}
  pick(x,y){
    this.mouse.set(x/innerWidth*2-1,-y/innerHeight*2+1);this.raycaster.setFromCamera(this.mouse,this.camera);
    const groups=[...this.entities.values()].filter(e=>e.data.id!==this.selfId&&e.networkVisible!==false).map(e=>e.object).concat([...this.gathers.values()].filter(e=>e.object.visible).map(e=>e.object)).concat([...this.signs.values()].map(e=>e.object));
    const hits=this.raycaster.intersectObjects(groups,true);
    if(!hits.length)return null;let obj=hits[0].object,destination=null;while(obj.parent&&!groups.includes(obj)){destination||=obj.userData.signDestination;obj=obj.parent;}
    for(const [id,e]of this.entities)if(e.object===obj)return{id,kind:e.kind};
    for(const [id,e]of this.gathers)if(e.object===obj)return{id,kind:e.data.storyId?'readable':e.data.type==='mailbox'?'mailbox':'gather',...(e.data.storyId?{reading:e.data}:e.data.type==='mailbox'?{mailbox:e.data}:{})};
    for(const [id,e]of this.signs)if(e.object===obj)return destination?{id,kind:'sign',sign:{...e.data,destinations:[destination]},destination}:null;
    return null;
  }
  socialEvent(event){const ent=this.entities.get(event.source);if(ent)ent.data.emote={id:event.emote,sequence:event.sequence,startedAt:event.startedAt,endsAt:event.endsAt};if(event.speech)this.speechEvent(event.source,event.speech);}
  speechEvent(source,text){const ent=this.entities.get(source);if(ent)ent.speech={text,endsAt:this.serverTime+7};}
  updateSocialReactions(){
    for(const e of this.entities.values()){const emote=e.data.emote,active=emote&&this.serverTime>=emote.startedAt&&this.serverTime<Math.min(emote.endsAt,emote.startedAt+3)&&e.data.hp>0;
      if(e.speech?.endsAt>this.serverTime&&e.data.hp>0){const anchor=this.nameplateAnchor(e),point=this.project(anchor.x,anchor.y+1.7,anchor.z),near=this.localPose&&Math.hypot(e.object.position.x-this.localPose.x,e.object.position.z-this.localPose.z)<35;
        if(!e.bubble){e.bubble=document.createElement('div');e.bubble.className='speech-bubble';document.querySelector('#labels').append(e.bubble);}e.bubble.textContent=e.speech.text;e.bubble.style.display=near&&point.visible&&this.buildings.labelVisible(this.camera.position,anchor)?'block':'none';e.bubble.style.left=`${point.x}px`;e.bubble.style.top=`${point.y}px`;
      }else{e.bubble?.remove();e.bubble=null;}
      if(!active){e.reaction?.remove();e.reaction=null;continue;}
      const o=e.object,anchor=this.nameplateAnchor(e),point=this.project(anchor.x,anchor.y+.9,anchor.z),near=this.localPose&&Math.hypot(o.position.x-this.localPose.x,o.position.z-this.localPose.z)<35;
      if(!e.reaction){e.reaction=document.createElement('div');e.reaction.className='emote-reaction';document.querySelector('#labels').append(e.reaction);}
      e.reaction.textContent=EMOTES[emote.id]?.glyph||'✦';e.reaction.style.display=near&&point.visible&&this.buildings.labelVisible(this.camera.position,anchor)?'block':'none';e.reaction.style.left=`${point.x}px`;e.reaction.style.top=`${point.y-Math.sin((this.serverTime-emote.startedAt)*4)*3}px`;e.reaction.style.opacity=String(Math.min(1,(this.serverTime-emote.startedAt)*5,(Math.min(emote.endsAt,emote.startedAt+3)-this.serverTime)*3));
    }
  }
  effect(event){
    const target=this.entities.get(event.target),source=this.entities.get(event.source);
    if(!target)return;
    target.flashUntil=performance.now()+150;
    if(event.kind==='recall')event={...event,kind:'ward'};
    const ability=SKILLS[event.kind],rangedAuto=event.kind==='attack'&&source?.data.classId&&classDefinition(source.data.classId).autoRange>5,kind=ability?(ability.heal?'heal':ability.shield?'ward':ability.area?'nova':ability.range>8?'lance':'strike'):rangedAuto?'lance':event.kind,color=source?.data.classId?classDefinition(source.data.classId).color:'#ffd991';
    if(['attack','strike','hurt','slam'].includes(kind))source?.object.userData.animator?.strike();
    if(event.amount){const p=this.project(target.object.position.x,target.object.position.y+2.5,target.object.position.z);if(p.visible){const el=document.createElement('div');el.className=`floater ${event.kind==='heal'?'heal':event.kind==='level'?'level':event.target===this.selfId?'hurt':''}`;el.textContent=event.kind==='ward'?`${event.amount} ward`:event.kind==='level'?`Level ${event.amount}`:event.kind==='heal'?`+${event.amount}`:event.amount;el.style.left=`${p.x+(Math.random()-.5)*30}px`;el.style.top=`${p.y}px`;document.querySelector('#floaters').append(el);setTimeout(()=>el.remove(),1200);}}
    if(kind==='lance'&&source){
      const end=target.object.position.clone().add(new THREE.Vector3(0,1,0));let projectile;
      if(classDefinition(source.data.classId).projectile==='arrow'){
        projectile=new THREE.Group();const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.8,5),material('#8f7853'));shaft.rotation.x=Math.PI/2;projectile.add(shaft);const tip=new THREE.Mesh(new THREE.ConeGeometry(.06,.18,4),material('#b9c7be'));tip.rotation.x=Math.PI/2;tip.position.z=.48;projectile.add(tip);const fletch=new THREE.Mesh(new THREE.BoxGeometry(.2,.025,.17),material(color));fletch.position.z=-.3;projectile.add(fletch);projectile.position.copy(source.object.position).add(new THREE.Vector3(0,1.4,0));this.scene.add(projectile);projectile.lookAt(end);
      }else{projectile=ball(.2,color,this.scene,source.object.position.x,source.object.position.y+1.4,source.object.position.z);projectile.material=material(color,{emissive:color,emissiveIntensity:2});}
      this.effects.push({object:projectile,age:0,duration:.35,start:projectile.position.clone(),end,projectile:true});
    }else if(['nova','level','heal','ward','slam','strike'].includes(kind)){
      const radius=kind==='nova'?(ability?.radius||ability?.range||6):kind==='slam'?7:kind==='level'?3:1.4;
      const ringColor=kind==='heal'||kind==='ward'?0xb1eda1:kind==='slam'?0xd68473:color;
      const center=(kind==='nova'&&!ability?.targetArea?source||target:target).object.position,mark=kind==='slam'?this.entities.get(event.source)?.data:null;
      const ring=new GroundArea({x:mark?.slamX??center.x,z:mark?.slamZ??center.z,radius:.3,maxRadius:.3+radius,innerRatio:.9,color:ringColor,opacity:.8});this.scene.add(ring);this.effects.push({object:ring,age:0,duration:.6,radius:kind==='slam'?(mark?.slamRadius||radius):radius});
    }
  }
  frame(dt,time,playing){
    const p=this.state?.self?{...this.state.self,...this.localPose}:null;
    if(playing&&p){
      const y=(p.y??heightAt(p.x,p.z))-(p.jumpHeight||0)+1.1;this.focus.set(p.x,this.playCamera?THREE.MathUtils.lerp(this.focus.y,y,1-Math.exp(-12*dt)):y,p.z);this.playCamera=true;
    }else if(!playing){
      this.playCamera=false;this.focus.set(...(UI_CONFIG.lobbyFocus||[0,1.6,12]));this.yaw=-.75+Math.sin(time*.03)*.08;this.zoom=22;this.pitch=.43;
    }
    if(time-this.lastShadowUpdate>=.05){const x=p?.x||0,z=p?.z||0;this.sun.position.set(x-35,60,z+15);this.sun.target.position.set(x,0,z);this.renderer.shadowMap.needsUpdate=true;this.lastShadowUpdate=time;}
    const orbit=cameraOrbit(this.focus,this.yaw,this.pitch,this.zoom,heightAt);
    this.camera.position.set(orbit.x,orbit.y,orbit.z);
    this.camera.lookAt(this.focus.x,orbit.targetY,this.focus.z);
    // HTML nameplates project before render(), so refresh the camera's inverse
    // world matrix now instead of waiting for the renderer to update it.
    this.camera.updateMatrixWorld(true);
    this.buildings.update(p,this.camera,this.focus,dt,playing);
    // Clear only the canopies between the camera and character; restore them
    // when the camera moves. Instanced trees retain their original matrices.
    this.updateWorld(dt,time,playing,p);
    for(const [id,e]of this.entities){
      const d=e.data,o=e.object;if(e.networkVisible===false)continue;const actorDistance=p?Math.hypot(d.x-p.x,d.z-p.z):0;o.visible=!playing||id===this.selfId||actorDistance<ACTOR_VIEW_DISTANCE;if(!o.visible){e.label.style.display='none';if(e.warning)e.warning.visible=false;continue;}this.fadeActor(e,playing&&id!==this.selfId?Math.min(1,(ACTOR_VIEW_DISTANCE-actorDistance)/(ACTOR_VIEW_DISTANCE-ACTOR_FADE_START)):1);
      {
        const pose=id===this.selfId&&this.localPose?this.localPose:this.timeline.sample(id,this.serverTime)||d;
        const moving=Math.hypot(pose.x-o.position.x,pose.z-o.position.z)>.025;
        o.position.x=pose.x;o.position.z=pose.z;
        const groundY=heightAt(o.position.x,o.position.z);
        o.position.y=e.kind!=='enemy'?(pose.y??groundY+(pose.jumpHeight||0)):groundY;
        o.rotation.y=pose.facing;
        if(o.userData.rig)this.animateCharacter(o,pose,dt,{dead:d.hp<=0,casting:id===this.selfId?!!this.localCasting:!!d.casting,emote:d.emote,time:this.serverTime});
        if(e.kind==='enemy'){
          this.animateCreature(o,pose,dt,d);const gesture=d.emote&&this.serverTime<d.emote.endsAt?d.emote:null;if(gesture&&o.userData.creature){const rig=o.userData.creature;const age=this.serverTime-gesture.startedAt,weight=Math.max(0,Math.min(1,age/.2,(gesture.endsAt-this.serverTime)/.3));if(gesture.id==='sniff'){rig.head.rotation.x+=(-.16+Math.sin(age*11)*.07)*weight;rig.model.position.z+=Math.sin(age*3)*.07*weight;}else if(gesture.id==='growl'){rig.head.rotation.x-=.2*weight;rig.model.position.y+=.05*weight;rig.model.rotation.z=Math.sin(age*18)*.012*weight;}else{rig.model.rotation.z=0;rig.head.rotation.x+=Math.sin(age*7)*.16*weight;rig.model.position.y+=Math.abs(Math.sin(age*4))*.035*weight;}}if(d.hp<=0)o.position.y-=.15;
          o.rotation.z=THREE.MathUtils.lerp(o.rotation.z,d.hp<=0?Math.PI*.4:0,Math.min(1,dt*7));
          if(ENEMY_TYPES[d.type].boss&&d.slamAt>this.serverTime){
            if(!e.warning){e.warning=new GroundArea({x:d.slamX??o.position.x,z:d.slamZ??o.position.z,radius:d.slamRadius||7});this.scene.add(e.warning);}
            e.warning.visible=true;e.warning.place(d.slamX??o.position.x,d.slamZ??o.position.z,d.slamRadius||7).setOpacity(.38+Math.sin(time*14)*.06);
          }else if(e.warning)e.warning.visible=false;
        }
      }

      e.label.classList.toggle('social-friendly',!!d.friendly);
      e.label.classList.toggle('featured',!!d.featured);
      const dist=p?Math.hypot(d.x-p.x,d.z-p.z):100,selected=p?.target===id;
      if(e.selected!==selected){e.label.classList.toggle('selected',selected);e.selected=selected;}
      const show=playing&&id!==this.selfId&&(e.kind==='npc'?dist<35:e.kind==='player'?dist<40:dist<23||selected);
      const anchor=this.nameplateAnchor(e),projected=this.project(anchor.x,anchor.y,anchor.z);
      const labelVisible=show&&projected.visible&&this.buildings.labelVisible(this.camera.position,anchor);
      e.label.style.display=labelVisible?'block':'none';
      if(labelVisible){
        e.label.style.transform=`translate(${projected.x}px,${projected.y}px) translate(-50%,-100%)`;
        // All names are assigned through textContent, never inserted as HTML.
        let html='';
        if(e.kind==='npc'){const offers=npcQuests(p,id);html=`${offers.length?`<div class="quest-marker">${offers.some(q=>questReady(p,q))?'?':'!'}</div>`:''}<div class="name"></div><div class="subtitle"></div>`;}
        else if(e.kind==='enemy')html=`<div class="name"></div>${d.hp>0?overheadHealthBar(d.hp,ENEMY_TYPES[d.type].hp,selected):d.lootable?'<div class="subtitle">✦ Loot · F</div>':''}`;
        else html='<div class="name"></div>';
        if(selected&&e.kind!=='enemy')html+=overheadHealthBar(d.hp,d.maxHp,true,true);
        const name=e.kind==='enemy'?`${ENEMY_TYPES[d.type].name} · ${ENEMY_TYPES[d.type].level}`:d.name,key=html+name+(d.title||'');
        if(e.labelKey!==key){e.label.innerHTML=html;e.label.querySelector('.name').textContent=name;if(e.kind==='npc')e.label.querySelector('.subtitle').textContent=d.title;e.labelKey=key;}
      }
    }
    const target=this.entities.get(p?.target);
    this.selection.update(target,this.camera,innerHeight,playing);
    this.questRing.visible=playing&&showQuestRing(p);this.questRing.setOpacity(.15+Math.sin(time*2)*.07);
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.age+=dt;const t=e.age/e.duration;if(e.projectile)e.object.position.lerpVectors(e.start,e.end,Math.min(1,t));else{e.object.setRadius(.3+t*e.radius).setOpacity(1-t);}if(t>=1){this.disposeEffect(e);this.effects.splice(i,1);}}
    if(playing)this.updateSocialReactions();this.renderer.render(this.scene,this.camera);
  }
  drawMap(canvas,large=false){
    const p=this.state?.self?{...this.state.self,...this.localPose}:null,cameraHeading=this.yaw+Math.PI;
    if(large)return drawAtlas(canvas,{player:p,players:this.state?.players,npcs:this.state?.npcs,enemies:this.state?.enemies,tracking:this.tracking,cameraHeading});
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,view=mapView(w,h,p,this.mapZoomIndex,large),sx=view.scale,sz=view.scale;
    const point=(x,z)=>mapPoint(view,x,z);
    if(!this.mapBackground)this.drawMapBackground();
    const backgroundBounds=this.mapBackgroundBounds||WORLD_BOUNDS;ctx.fillStyle='#1c3027';ctx.fillRect(0,0,w,h);ctx.drawImage(this.mapBackground,...point(backgroundBounds.minX,backgroundBounds.minZ),(backgroundBounds.maxX-backgroundBounds.minX)*sx,(backgroundBounds.maxZ-backgroundBounds.minZ)*sz);
    if(large){ctx.textAlign='center';for(const l of LANDMARKS){ctx.font=`${Math.round(w*.028)}px Georgia`;ctx.fillStyle=l.color;ctx.fillText(l.name,...point(l.x,l.z+10));}}
    const hits=[],overlays=p&&this.tracking.objectives?questOverlays(p,this.state.enemies,this.tracking):[];
    if(!overlays.some(q=>q.selected)&&overlays.length)overlays[0].selected=true;
    if(!large){this.questNavigation=overlays.find(q=>q.selected)||null;this.mapQuestOverlays=overlays;this.mapQuestRegions=overlays.filter(q=>!q.ready).map(q=>{const[x,y]=point(q.area.x,q.area.z);return {quest:q,x,y,radius:q.area.radius*sx};});}
    for(const overlay of overlays){
      if(overlay.ready)continue;
      const[x,z]=point(overlay.area.x,overlay.area.z),r=overlay.area.radius*sx;
      ctx.fillStyle=overlay.selected?'rgba(238,197,104,.17)':'rgba(103,160,221,.09)';ctx.strokeStyle=overlay.selected?'#edca7fa8':'#84b3da77';ctx.lineWidth=overlay.selected?1.6:1;
      ctx.beginPath();ctx.arc(x,z,r,0,7);ctx.fill();ctx.stroke();
      if(overlay.selected)for(const target of overlay.points){if(RESOURCE_TYPES[target.type]&&p.harvestCooldowns?.[target.id]>0)continue;const[tx,tz]=point(target.x,target.z);ctx.fillStyle='#edd28f';ctx.beginPath();ctx.moveTo(tx,tz-3);ctx.lineTo(tx+3,tz);ctx.lineTo(tx,tz+3);ctx.lineTo(tx-3,tz);ctx.closePath();ctx.fill();}
    }
    if(p){
      if(this.tracking.enemies)for(const e of this.state.enemies)if(e.hp>0){const pose=this.timeline.sample(e.id,this.serverTime)||e;ctx.fillStyle=e.friendly?'#94c89c':e.type==='warden'?'#db967f':'#c58e78';ctx.beginPath();ctx.arc(...point(pose.x,pose.z),e.type==='warden'?3:1.8,0,7);ctx.fill();}
      for(const marker of trackingMarkers(p,this.tracking,this.state?.npcs||[])){
        const[x,y]=point(marker.x,marker.z);if(x<7||x>w-7||y<9||y>h-8)continue;
        if(marker.kind==='npc'){ctx.fillStyle='#17291ee8';ctx.beginPath();ctx.arc(x,y-2,7,0,7);ctx.fill();ctx.font='bold 13px Arial';ctx.fillStyle=marker.glyph==='!'||marker.glyph==='?'?'#ffe092':'#d8dbb5';ctx.textAlign='center';ctx.fillText(marker.glyph,x,y+2);}
        else if(['waypoint','road','mailbox','flight','capital'].includes(marker.kind)){ctx.fillStyle=marker.kind==='waypoint'?'#8fe0d0':'#d3c6a5';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.fillText(marker.glyph,x,y+4);}
        else if(marker.kind==='herbs'){ctx.fillStyle='#8ed17a';ctx.beginPath();ctx.ellipse(x,y,3,5,-.6,0,7);ctx.fill();ctx.strokeStyle='#264734';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-2,y+5);ctx.lineTo(x+1,y-3);ctx.stroke();}
        else{ctx.fillStyle=marker.kind==='mining'?'#dbb181':'#a2b8d0';ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+4,y);ctx.lineTo(x,y+4);ctx.lineTo(x-4,y);ctx.closePath();ctx.fill();}
        hits.push({...marker,x,y,radius:8});
      }
      const clusters=[];
      for(const overlay of overlays){
        if(overlay.target.self)continue;
        const edge=edgePoint(view,overlay.target.x,overlay.target.z,12);
        if(large&&edge.outside)continue;
        const existing=clusters.find(c=>Math.hypot(c.x-edge.x,c.y-edge.y)<12);
        if(existing)existing.quests.push(overlay);else clusters.push({...edge,quests:[overlay]});
      }
      for(const cluster of clusters){
        const selected=cluster.quests.some(q=>q.selected),label=cluster.quests.length>3?`${(cluster.quests.find(q=>q.selected)||cluster.quests[0]).number} +${cluster.quests.length-1}`:cluster.quests.map(q=>q.number).join('·'),radius=Math.min(24,6+label.length*3),x=cluster.x,y=cluster.y;
        if(cluster.outside){ctx.save();ctx.translate(x,y);ctx.rotate(cluster.angle);ctx.fillStyle=selected?'#f8db94':'#b3d0e8';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(3,-4);ctx.lineTo(3,4);ctx.closePath();ctx.fill();ctx.restore();}
        ctx.fillStyle=selected?'#785b2aed':'#253e55ed';ctx.strokeStyle=selected?'#f2d08e':'#a2c9e7';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(x,y,radius,8,0,0,7);ctx.fill();ctx.stroke();ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillStyle='#fff0c1';ctx.fillText(label,x,y+3);
        hits.push({id:`quest:${cluster.quests.map(q=>q.id).join(',')}`,kind:'quest',quests:cluster.quests.map(q=>q.id),x,y,radius:radius+3,title:cluster.quests.map(q=>`${q.number}. ${q.title}`).join('\n'),detail:cluster.quests.map(q=>`${q.objective} · ${q.progress}/${q.count}`).join('\n')+'\nClick to track this quest.'});
      }
      // Orbit yaw places the camera behind its look direction. The minimap
      // arrow points where the camera looks, independent of movement/facing.
      const selfHeading=cameraHeading;
      for(const v of this.state.players){const self=v.id===this.selfId,pose=self?p:this.timeline.sample(v.id,this.serverTime)||v;const[x,z]=point(pose.x,pose.z);ctx.fillStyle=self?'#fff1b9':'#9fd4b8';ctx.beginPath();ctx.arc(x,z,self?3.8:2.5,0,7);ctx.fill();if(self){ctx.save();ctx.translate(x,z);ctx.rotate(-selfHeading);ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(-4,1);ctx.lineTo(4,1);ctx.closePath();ctx.fill();ctx.restore();}}
    }
    if(!large){this.minimapHits=hits;canvas.dataset.playerHeading=String(cameraHeading);canvas.dataset.centerX=String(view.centerX);canvas.dataset.centerZ=String(view.centerZ);canvas.dataset.radius=String(view.radius);const ids=hits.map(hit=>hit.id).join('|'),quests=overlays.map(q=>q.id).join('|');if(canvas.dataset.markerIds!==ids)canvas.dataset.markerIds=ids;if(canvas.dataset.questIds!==quests)canvas.dataset.questIds=quests;}
    ctx.strokeStyle='#d7cba04d';ctx.strokeRect(4,4,w-8,h-8);
  }
}
// Worlds own scenery and creature rendering; interaction, prediction, camera,
// maps, targeting, nameplates, effects and settings stay in this shared class.
Object.assign(GameScene.prototype,worldPresentation);
