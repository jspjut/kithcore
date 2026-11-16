import {progressionArmorParts,progressionWeaponParts} from './equipment-progression.js';
import * as THREE from 'three';
import {ITEMS,visibleEquipment} from '../shared/content.js';
import {armorParts,extraWeaponParts,decorateReward} from './armor-models.js';

// Original, code-built item assets. Each part is authored in its rig socket's
// coordinates, then baked once and shared by every character wearing the item.
const templates=new Map(),materials=new Map();
function material(color,metal=false,glow=false){
  const key=`${color}:${metal}:${glow}`;
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.42:.92,metalness:metal?.55:0,...(glow?{emissive:color,emissiveIntensity:.28}:{})}));
  return materials.get(key);
}
function mesh(parent,geometry,color,x=0,y=0,z=0,metal=false,glow=false){
  const o=new THREE.Mesh(geometry,material(color,metal,glow));o.position.set(x,y,z);parent.add(o);return o;
}
const box=(p,w,h,d,c,x,y,z,metal=false)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z,metal);
const cylinder=(p,top,bottom,h,c,x,y,z,metal=false)=>mesh(p,new THREE.CylinderGeometry(top,bottom,h,12),c,x,y,z,metal);
const sphere=(p,r,c,x,y,z,metal=false)=>mesh(p,new THREE.SphereGeometry(r,12,8),c,x,y,z,metal);
const part=()=>new THREE.Group();

function sword(a){
  const p=part(),dawn=a.style==='dawn',copper=a.style==='copper',width=dawn?.18:copper?.14:.1;
  // Author around the middle of the grip, then mount it in the palm. A normal
  // grip sends the blade forward from the thumb, perpendicular to the forearm.
  cylinder(p,.045,.045,.22,a.detail,0,0,0);
  sphere(p,.065,a.trim,0,.16,0,true);
  box(p,dawn?.42:copper?.36:.29,.065,.105,a.trim,0,-.13,0,true);
  const blade=new THREE.Shape();blade.moveTo(-width/2,-.17);blade.lineTo(width/2,-.17);blade.lineTo(width*.38,-.68);blade.lineTo(0,-.86);blade.lineTo(-width*.38,-.68);blade.closePath();
  mesh(p,new THREE.ExtrudeGeometry(blade,{depth:.045,bevelEnabled:true,bevelSize:.013,bevelThickness:.008,bevelSegments:1,steps:1}),a.main,0,0,-.0225,true,dawn);
  box(p,.018,.5,.008,a.trim,0,-.44,.033,true);
  if(dawn){const gem=sphere(p,.052,'#ffe5ab',0,-.12,.07,true);gem.scale.set(.8,1.3,.55);}
  if(copper)for(const side of [-1,1])box(p,.055,.13,.07,a.trim,side*.16,-.085,0,true).rotation.z=side*.35;
  // Slightly lower the tip at rest and keep the cutting edges vertical.
  p.rotation.set(-Math.PI/2+.2,Math.PI/2,0);
  p.position.set(0,-.34,0);return {rightHand:p};
}
function shield(a){
  const p=part();
  // Shield face points away from the left forearm, on the outside of the body.
  const face=cylinder(p,.34,.34,.085,a.main,-.12,-.08,.04);face.rotation.z=Math.PI/2;face.scale.x=1.16;
  const rim=mesh(p,new THREE.TorusGeometry(.34,.035,6,20),a.trim,-.17,-.08,.04,true);rim.rotation.y=Math.PI/2;rim.scale.y=1.16;
  for(const z of [-.13,0,.13])box(p,.009,.55,.015,a.detail,-.167,-.08,z+.04);
  const boss=sphere(p,.105,a.trim,-.197,-.08,.04,true);boss.scale.x=.6;
  for(const y of [-.32,.16])box(p,.018,.04,.45,a.trim,-.18,y,.04,true);
  return {leftHand:p};
}
function hat(a){
  const p=part();
  mesh(p,new THREE.SphereGeometry(.278,16,10,0,Math.PI*2,0,Math.PI*.55),a.main,0,.055,-.025);
  cylinder(p,.355,.35,.045,a.main,0,.018,-.015).scale.z=1.04;
  cylinder(p,.28,.28,.065,a.trim,0,.052,-.025);
  const badge=sphere(p,.043,a.trim,0,.092,.251,true);badge.scale.z=.3;
  return {head:p};
}
function coat(a){
  const p=part(),parts={torso:p},plate=a.style==='sentinel',bark=a.style==='bark';
  cylinder(p,.318,.27,.79,a.main,0,1.245,0,plate).scale.z=.88;
  cylinder(p,.29,.3,.09,a.detail,0,.91,0).scale.z=.9;
  box(p,.095,.085,.045,a.trim,0,.91,.277,true);
  // A split hem leaves room for the independently animated thighs.
  for(const side of [-1,1]){
    const hem=box(p,.29,.23,.075,a.main,side*.16,.79,.2);hem.rotation.z=side*-.09;
    const back=box(p,.3,.26,.07,a.detail,side*.16,.8,-.235);back.rotation.z=side*.08;
    const sleeve=part(),forearm=part();
    cylinder(sleeve,.135,.118,.31,a.main,0,-.16,0,plate);
    if(plate||bark){
      const patch=sphere(sleeve,.158,a.trim,side*.01,-.055,0,plate);patch.scale.set(1,.65,.95);
      box(forearm,.21,.23,.24,a.main,0,-.14,0,plate);
      box(forearm,.215,.05,.245,a.trim,0,-.25,0,plate);
    }else cylinder(forearm,.108,.095,.29,a.main,0,-.145,0);
    parts[side===-1?'leftSleeve':'rightSleeve']=sleeve;parts[side===-1?'leftForearm':'rightForearm']=forearm;
  }
  if(plate){
    const breast=box(p,.43,.43,.09,a.main,0,1.32,.254,true);breast.rotation.x=-.04;
    for(const side of [-1,1])box(p,.055,.49,.025,a.trim,side*.2,1.32,.308,true).rotation.z=side*-.13;
    const emblem=box(p,.14,.14,.035,a.trim,0,1.38,.32,true);emblem.rotation.z=Math.PI/4;
    box(p,.38,.055,.03,a.trim,0,1.1,.31,true);
  }else if(bark){
    for(const x of [-.19,-.095,0,.095,.19])box(p,.068,.55,.06,a.detail,x,1.26,.25).rotation.z=x*.4;
    box(p,.48,.045,.04,a.trim,0,1.4,.294).rotation.z=-.22;
    box(p,.43,.045,.04,a.trim,0,1.15,.294).rotation.z=.19;
  }else{
    box(p,.037,.56,.035,a.trim,0,1.27,.279);
    for(const y of [1.09,1.25,1.41])sphere(p,.025,a.trim,.065,y,.278,true);
    box(p,.12,.13,.03,a.detail,-.145,1.31,.266);
  }
  return parts;
}
function trousers(a){
  const parts={};
  for(const side of ['left','right']){
    const upper=part(),lower=part();
    box(upper,.255,.435,.285,a.main,0,-.213,0);
    box(upper,.04,.35,.03,a.trim,side==='left'?-.11:.11,-.21,.14);
    box(lower,.225,.425,.253,a.main,0,-.208,0);
    box(lower,.19,.155,.025,a.detail,0,-.055,.139);
    parts[side+'Thigh']=upper;parts[side+'Shin']=lower;
  }
  return parts;
}
function boots(a){
  const parts={};
  for(const side of ['left','right']){
    const p=part();box(p,.277,.17,.42,a.main,0,-.015,.09);
    box(p,.287,.045,.43,a.detail,0,-.102,.09);
    cylinder(p,.13,.12,.2,a.main,0,.085,0).scale.z=.94;
    cylinder(p,.143,.143,.045,a.trim,0,.19,0).scale.z=.94;
    box(p,.15,.04,.033,a.trim,0,.05,.16);
    parts[side+'Foot']=p;
  }
  return parts;
}
function hafted(a){
  const p=part(),long=a.model==='staff'||a.model==='spear';
  cylinder(p,.033,.038,long?1.8:.85,a.detail,0,long?-.35:-.2,0);
  for(const y of[-.08,0,.08])cylinder(p,.045,.045,.035,a.trim,0,y,0,true);
  sphere(p,.055,a.trim,0,long?.58:.25,0,true);
  if(a.model==='axe'){
    const blade=new THREE.Shape();blade.moveTo(-.05,-.48);blade.lineTo(.36,-.4);blade.quadraticCurveTo(.49,-.64,.31,-.89);blade.lineTo(-.05,-.76);blade.closePath();
    mesh(p,new THREE.ExtrudeGeometry(blade,{depth:.075,bevelEnabled:true,bevelSize:.015,bevelThickness:.01,bevelSegments:1,steps:1}),a.main,0,0,-.0375,true);
    cylinder(p,.08,.08,.38,a.trim,0,-.61,0,true);box(p,.16,.1,.13,a.main,-.12,-.58,0,true);
  }else if(a.model==='hammer'){
    box(p,.55,.29,.3,a.main,0,-.59,0);for(const x of[-.21,.21])box(p,.07,.32,.33,a.trim,x,-.59,0,true);box(p,.09,.33,.34,a.trim,0,-.59,0,true);
  }else if(a.model==='spear'){
    mesh(p,new THREE.ConeGeometry(.13,.46,4),a.main,0,-1.27,0,true).rotation.z=Math.PI;box(p,.035,.33,.04,a.trim,0,-1.24,.065,true);cylinder(p,.065,.065,.12,a.trim,0,-1.02,0,true);
  }else{
    for(const side of[-1,1]){const fork=cylinder(p,.035,.045,.4,a.main,side*.12,-1.04,0);fork.rotation.z=side*-.45;}
    cylinder(p,.17,.17,.045,a.trim,0,-1.14,0,true);sphere(p,.13,a.glow||a.trim,0,-1.02,0).material=material(a.glow||a.trim,false,true);
    for(const side of[-1,1])box(p,.025,.26,.025,a.trim,side*.12,-1.02,0,true);
  }
  p.rotation.set(-Math.PI/2+.2,Math.PI/2,0);p.position.set(0,-.34,0);return {rightHand:p};
}
function helmet(a){
  const p=part();mesh(p,new THREE.SphereGeometry(.28,16,10,0,Math.PI*2,0,Math.PI*.52),a.main,0,.065,-.025,true);
  cylinder(p,.286,.286,.07,a.trim,0,.045,-.025,true);box(p,.055,.22,.045,a.trim,0,-.035,.254,true);
  for(const side of[-1,1]){const cheek=box(p,.055,.22,.18,a.main,side*.24,-.08,.06,true);cheek.rotation.z=side*-.1;box(p,.04,.27,.25,a.trim,side*.2,.16,-.02,true).rotation.z=side*-.5;}
  return {head:p};
}
function pack(a){
  const p=part();box(p,.55,.66,.3,a.main,0,1.23,-.43);box(p,.58,.12,.32,a.trim,0,1.56,-.44);box(p,.32,.23,.08,a.detail,0,1.17,-.62);
  for(const x of[-.19,.19]){box(p,.045,.69,.325,a.detail,x,1.23,-.44);box(p,.08,.08,.035,a.trim,x,1.3,-.62,true);}
  const roll=cylinder(p,.13,.13,.65,a.main,0,1.76,-.44);roll.rotation.z=Math.PI/2;for(const x of[-.22,.22])box(p,.045,.27,.27,a.detail,x,1.76,-.44);
  return {torso:p};
}
const factories={sword,shield,hat,coat,trousers,boots,axe:hafted,hammer:hafted,staff:hafted,spear:hafted,helmet,pack,armor:armorParts,bow:extraWeaponParts,dagger:extraWeaponParts,focus:extraWeaponParts,greatsword:extraWeaponParts};

// Merge the decorative primitives by material, once per item/socket, to keep
// equipped characters inexpensive. Clones share the baked geometry/materials.
function bake(root){
  root.updateMatrixWorld(true);const batches=new Map();
  root.traverse(o=>{if(!o.isMesh)return;const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);
    if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);o.geometry.dispose();});
  const result=part();
  for(const [mat,geometries]of batches){
    const total=geometries.reduce((n,g)=>n+g.attributes.position.count,0),g=new THREE.BufferGeometry();
    for(const key of ['position','normal']){const values=new Float32Array(total*3);let offset=0;for(const source of geometries){values.set(source.attributes[key].array,offset);offset+=source.attributes[key].array.length;}g.setAttribute(key,new THREE.BufferAttribute(values,3));}
    g.computeBoundingSphere();g.userData.equipmentAsset=true;
    const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;result.add(m);geometries.forEach(g=>g.dispose());
  }
  return result;
}
export function equipmentModel(id){
  return equipmentRecipe(ITEMS[id]?.appearance);
}
export function equipmentRecipe(a){
  if(!a||!a.shapeTier&&!factories[a.model])return null;const key=JSON.stringify(a);
  const factory=a.shapeTier?(a.model==='armor'?progressionArmorParts:progressionWeaponParts):factories[a.model];
  if(!templates.has(key))templates.set(key,Object.fromEntries(Object.entries(decorateReward(factory(a),a)).map(([socket,root])=>[socket,bake(root)])));
  return Object.fromEntries(Object.entries(templates.get(key)).map(([socket,root])=>[socket,root.clone(true)]));
}
export class CharacterEquipment{
  constructor(rig){this.rig=rig;this.pieces=new Map();}
  update(equipment){
    for(const [slot,id]of Object.entries(visibleEquipment(equipment))){
      const previous=this.pieces.get(slot);if(previous?.id===id)continue;
      if(previous){for(const root of Object.values(previous.parts))root.removeFromParent();this.pieces.delete(slot);}
      if(id){const parts=equipmentModel(id);if(parts){for(const [socket,root]of Object.entries(parts)){root.name=`equipment:${slot}:${id}:${socket}`;root.userData={equipmentSlot:slot,itemId:id,socket};this.rig.sockets[socket].add(root);}this.pieces.set(slot,{id,parts});}}
    }
    this.rig.hair.visible=!this.pieces.has('head');this.rig.baseTorso.visible=!this.pieces.has('armor');
    for(const base of this.rig.baseFeet)base.visible=!this.pieces.has('feet');
    for(const base of this.rig.baseLegs)base.visible=!this.pieces.has('legs');
  }
  clear(){this.update({});}
  debug(){return Object.fromEntries([...this.pieces].map(([slot,p])=>[slot,{item:p.id,sockets:Object.keys(p.parts),meshes:Object.values(p.parts).reduce((n,p)=>n+p.children.length,0)}]));}
}
