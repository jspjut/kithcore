import * as THREE from 'three';
import {GameScene} from './runtime/scene.js';
import {heightAt,NPCS,ENEMY_SPAWNS,ENEMY_TYPES} from './runtime/shared/content.js';
const canvas=document.querySelector('#world'),status=document.querySelector('#status');
try{
 const scenes=await fetch('./scenes.json').then(r=>r.json()),id=new URLSearchParams(location.search).get('scene'),view=scenes.find(s=>s.id===id)||scenes[0];
 const flightMode=new URLSearchParams(location.search).has('flight'),flight=flightMode?await fetch('./flyby.json').then(r=>r.json()):null;
 document.querySelector('#scene-name').textContent=flightMode?'World flyby':view.title;
 const scene=new GameScene(canvas);scene.questRing.visible=false;scene.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
 let yaw=view.yaw,pitch=view.pitch,distance=view.distance,drag=null,visible=true,auto=false,previous=performance.now();
 let flightStarted=null,flightDistance=0,lastFlightPosition=null;
 const cameraCurve=flight?new THREE.CatmullRomCurve3(flight.points.map(p=>new THREE.Vector3(p.camera[0],p.camera[2],p.camera[1])),true,'catmullrom',.35):null;
 const lookCurve=flight?new THREE.CatmullRomCurve3(flight.points.map(p=>new THREE.Vector3(p.look[0],0,p.look[1])),true,'catmullrom',.35):null;
 const center=new THREE.Vector3(view.x,heightAt(view.x,view.z)+1.5,view.z);scene.focus.copy(center);
 for(const npc of NPCS.filter(n=>Math.hypot(n.x-view.x,n.z-view.z)<80))scene.addNPC(npc);
 for(const spawn of ENEMY_SPAWNS.filter(s=>Math.hypot(s.x-view.x,s.z-view.z)<45)){const o=scene.creature(ENEMY_TYPES[spawn.type].appearanceType||spawn.type,ENEMY_TYPES[spawn.type]);o.position.set(spawn.x,heightAt(spawn.x,spawn.z),spawn.z);scene.scene.add(o);}
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(drag){yaw-=(e.clientX-drag.x)*.008;pitch=Math.max(.15,Math.min(1.2,pitch+(e.clientY-drag.y)*.006));drag={x:e.clientX,y:e.clientY};}});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(8,Math.min(100,distance+e.deltaY*.025));},{passive:false});canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.15;if(e.key==='ArrowRight')yaw+=.15;if(e.key==='ArrowUp')pitch=Math.min(1.2,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(.15,pitch-.1);if(e.key==='+')distance=Math.max(8,distance-3);if(e.key==='-')distance=Math.min(100,distance+3);});
 document.querySelector('#reset').onclick=()=>{yaw=view.yaw;pitch=view.pitch;distance=view.distance;};document.querySelector('#rotate').onclick=e=>{auto=!auto;e.target.setAttribute('aria-pressed',String(auto));};
 new IntersectionObserver(entries=>visible=entries[0].isIntersecting).observe(canvas);
 function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;if(!visible||document.hidden)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,time=reduced?0:now/1000;scene.ambientMotion=!reduced;if(auto&&!reduced)yaw+=dt*.12;
  if(flightMode){const progress=flightStarted&&!reduced?((now-flightStarted)/(flight.seconds*1000))%1:0,pos=cameraCurve.getPointAt(progress),look=lookCurve.getPointAt(progress);center.set(look.x,heightAt(look.x,look.z)+2,look.z);scene.focus.copy(center);scene.camera.position.set(pos.x,heightAt(pos.x,pos.z)+pos.y,pos.z);if(flightStarted){if(lastFlightPosition)flightDistance+=lastFlightPosition.distanceTo(scene.camera.position);lastFlightPosition=scene.camera.position.clone();}}
  else scene.camera.position.set(center.x+Math.sin(yaw)*Math.cos(pitch)*distance,center.y+Math.sin(pitch)*distance,center.z+Math.cos(yaw)*Math.cos(pitch)*distance);scene.camera.lookAt(center);scene.camera.updateMatrixWorld();scene.sun.position.set(center.x-35,center.y+60,center.z+15);scene.sun.target.position.copy(center);scene.renderer.shadowMap.needsUpdate=true;scene.buildings.update(null,scene.camera,center,dt,false);scene.updateWorld(dt,time,false,null);scene.renderer.render(scene.scene,scene.camera);
  status.textContent='Drag to orbit / Scroll to zoom / Arrow keys to look';window.scenePreview={rendered:true,id:view.id,calls:scene.renderer.info.render.calls,flightDistance,startFlight:()=>{flightStarted=performance.now();flightDistance=0;lastFlightPosition=null;},shaderErrors:scene.renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};
 }requestAnimationFrame(frame);
}catch(error){status.textContent='Scene preview unavailable: '+error.message;console.error(error);}
