import {applyEmote} from './emote-animation.js';
import * as THREE from 'three';
import {addRaceTraits,racePalette} from './race-traits.js';
import {CharacterAnimator} from './animation.js';
import {CharacterEquipment} from './equipment.js';
import {heightAt} from '../shared/terrain.js';
import {appearancePalette,normalizeAppearance,FACE_SHAPES,BODY_BUILDS} from '../shared/character.js';
const materials=new Map();
function mesh(geometry,color,parent,x=0,y=0,z=0){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.95}));const o=new THREE.Mesh(geometry,materials.get(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(w,h,d,c,p,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),c,p,x,y,z);
const ball=(r,c,p,x,y,z,detail=1)=>mesh(new THREE.IcosahedronGeometry(r,detail),c,p,x,y,z);
const cylinder=(r1,r2,h,c,p,x,y,z,n=7)=>mesh(new THREE.CylinderGeometry(r1,r2,h,n),c,p,x,y,z);
function makeHair(parent,style,color){
  if(style==='bald')return;
  const cap=ball(.25,color,parent,0,.11,-.04,2);cap.scale.y=.55;
  if(style==='swept'){
    const fringe=ball(.18,color,parent,.07,.16,.07,1);fringe.scale.set(1.1,.45,.75);fringe.rotation.z=-.25;
    for(const side of [-1,1])box(.07,.14,.09,color,parent,side*.22,-.015,-.02);
  }else if(style==='bob'){
    const back=ball(.255,color,parent,0,-.035,-.075,2);back.scale.set(1,.85,.68);
    for(const side of [-1,1]){const lock=ball(.13,color,parent,side*.205,-.085,-.015,2);lock.scale.set(.65,1.4,.8);}
  }else if(style==='ponytail'){
    ball(.08,'#b49a68',parent,0,.07,-.25,1);
    const tail=ball(.15,color,parent,0,-.10,-.31,2);tail.scale.set(.65,1.7,.8);tail.rotation.x=.22;
  }else if(style==='braid'){
    for(let i=0;i<6;i++)ball(.064-i*.005,color,parent,(i%2?1:-1)*.02,.03-i*.067,-.27-i*.012,1);
    ball(.045,'#b49a68',parent,0,-.39,-.34,1);
  }
}
function makeFace(head,palette,appearance){
  const face=new THREE.Group();const shape=FACE_SHAPES[appearance.face];face.scale.set(shape.width,1,shape.depth);head.add(face);
  ball(.24,palette.skin,face,0,0,0,2);
  for(const side of [-1,1]){
    const ear=ball(.06,palette.skin,face,side*.232,-.045,-.015,1);ear.scale.set(.6,1,.65);
    ball(.026,'#e8e3d3',face,side*.084,-.055,.218,2);
    ball(.015,palette.eyes,face,side*.084,-.055,.241,2);
    ball(.007,'#202c29',face,side*.084,-.055,.254,1);
    box(.065,.014,.014,palette.hair,face,side*.084,-.007,.228).rotation.z=side*-.08;
  }
  const nose=ball(.033,palette.skin,face,0,-.096,.235,1);nose.scale.set(.75,1.1,1.3);
  box(.07,.012,.012,'#935f50',face,0,-.16,.185);
  if(appearance.facialHair!=='none'){
    for(const side of [-1,1]){const moustache=ball(.055,palette.hair,face,side*.035,-.137,.204,2);moustache.scale.set(1.1,.28,.55);moustache.rotation.z=side*.12;}
    if(appearance.facialHair==='short'){const beard=ball(.19,palette.hair,face,0,-.18,.075,2);beard.scale.set(.96,.4,.8);}
    if(appearance.facialHair==='full'){const beard=cylinder(.17,.055,.28,palette.hair,face,0,-.25,.085,8);beard.scale.z=.8;}
  }
  return face;
}
export function createHumanoid(color,npc=false,look='hearth',appearance,paletteOverride={},raceId='human'){
    const options=normalizeAppearance(appearance,look),palette=appearancePalette(options,look);
    racePalette(raceId,palette);
    Object.assign(palette,paletteOverride);
    if(npc)Object.assign(palette,{skin:'#d8b18a',hair:'#81735a'});
    const o=new THREE.Group(),body=new THREE.Group(),torso=new THREE.Group(),lowerBody=new THREE.Group();o.add(body);body.add(torso,lowerBody);
    if(!npc){const build=BODY_BUILDS[options.build];body.scale.set(build.width,1,build.depth);}
    const cape=box(.78,1.05,.17,npc?'#677d68':'#367b76',torso,0,1.13,-.29);
    cape.visible=npc;
    const baseTorso=cylinder(.3,.25,.8,npc?color:palette.cloth,torso,0,1.24,0,6),head=new THREE.Group();
    cylinder(.095,.105,.22,npc?'#d8b18a':palette.skin,torso,0,1.73,0,8);
    head.position.y=1.98;torso.add(head);const face=makeFace(head,palette,options),hair=new THREE.Group();head.add(hair);makeHair(hair,options.hairStyle,palette.hair);
    const legs=[],arms=[],sockets={torso,head},baseLegs=[],baseFeet=[];
    for(const side of [-1,1]){
      const prefix=side===-1?'left':'right';
      const hip=new THREE.Group(),knee=new THREE.Group(),ankle=new THREE.Group();hip.position.set(side*.17,.95,0);lowerBody.add(hip);
      baseLegs.push(box(.22,.43,.25,'#4d5646',hip,0,-.215,0));knee.position.y=-.43;hip.add(knee);
      baseLegs.push(box(.19,.43,.22,'#4d5646',knee,0,-.215,0));ankle.position.y=-.43;knee.add(ankle);baseFeet.push(box(.25,.18,.38,'#514d3a',ankle,0,-.03,.09));legs.push({hip,knee,ankle});
      const shoulder=new THREE.Group(),elbow=new THREE.Group();shoulder.position.set(side*.4,1.55,0);torso.add(shoulder);shoulder.rotation.z=side*.1;
      cylinder(.12,.1,.33,npc?color:palette.cloth,shoulder,0,-.165,0);ball(npc?.19:.12,npc?color:palette.cloth,shoulder,0,0,0);
      elbow.position.y=-.33;shoulder.add(elbow);cylinder(.1,.085,.32,npc?color:palette.cloth,elbow,0,-.16,0);ball(.095,npc?'#d8b18a':palette.skin,elbow,0,-.34,0);arms.push({shoulder,elbow});
      Object.assign(sockets,{[prefix+'Thigh']:hip,[prefix+'Shin']:knee,[prefix+'Foot']:ankle,[prefix+'Sleeve']:shoulder,[prefix+'Forearm']:elbow,[prefix+'Hand']:elbow});
    }
    o.userData.rig={body,torso,lowerBody,cape,legs,arms,head,hair,face,baseTorso,baseLegs,baseFeet,sockets};if(raceId!=='human')addRaceTraits(o.userData.rig,raceId,{dark:palette.hair,wood:'#786c52',leaf:palette.skin,stone:palette.skin,trim:'#b9ab79',glow:palette.eyes});o.userData.raceId=raceId;o.userData.appearance=options;o.userData.animator=new CharacterAnimator();
    if(!npc)o.userData.equipment=new CharacterEquipment(o.userData.rig);return o;
  }
export function animateHumanoid(o,pose,dt,options={},sampleHeight=heightAt){
    const rig=o.userData.rig,animation=o.userData.animator.step(pose,dt,sampleHeight,{...options,scaleX:rig.body.scale.x,scaleZ:rig.body.scale.z});o.userData.animation=animation;
    o.rotation.y=animation.facing;rig.body.position.y=animation.bodyY;rig.lowerBody.rotation.y=animation.lowerYaw;rig.torso.rotation.set(animation.lean,animation.torsoYaw,animation.roll);rig.cape.rotation.x=-animation.cape;rig.head.rotation.y=animation.headYaw;
    rig.legs.forEach((leg,i)=>{leg.hip.rotation.x=animation.legs[i].hip;leg.knee.rotation.x=animation.legs[i].knee;leg.ankle.rotation.x=animation.legs[i].ankle;});
    rig.head.rotation.x=0;rig.arms.forEach((arm,i)=>{arm.shoulder.rotation.z=i===0?-.1:.1;arm.shoulder.rotation.x=i===0?animation.leftArm:animation.rightArm;arm.elbow.rotation.x=-animation.elbow;});
    o.userData.emotePose=options.emote&&!options.dead&&!options.casting&&animation.speed<.5&&animation.air<.1?applyEmote(rig,options.emote,options.time??0):null;
    for(const slot of ['weapon','offhand'])for(const part of Object.values(o.userData.equipment?.pieces.get(slot)?.parts||{}))part.visible=!o.userData.emotePose;
  }

export function disposeHumanoid(o){o.userData.equipment?.clear();o.removeFromParent();o.traverse(n=>{if(n.geometry&&!n.geometry.userData.equipmentAsset&&!n.geometry.userData.libraryShared)n.geometry.dispose();});}
