import * as THREE from 'three';
import {classDefinition,normalizeIdentity,raceDefinition} from '../shared/adventurers.js';
import {createHumanoid,animateHumanoid,disposeHumanoid} from './character.js';
export class CharacterPreview{
  constructor(canvas){
    this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight(0xffebcf,0x557c77,2.8));
    const key=new THREE.DirectionalLight(0xffe2b3,3.2);key.position.set(-3,5,4);this.scene.add(key);
    const rim=new THREE.DirectionalLight(0x9ddad5,2);rim.position.set(3,2,-3);this.scene.add(rim);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(1.4,48),new THREE.MeshBasicMaterial({color:'#15322e',transparent:true,opacity:.65}));floor.rotation.x=-Math.PI/2;this.scene.add(floor);
    this.camera=new THREE.PerspectiveCamera(34,1,.1,30);this.angle=.2;this.distance=5.3;this.focusHeight=1.15;this.faceView=false;this.signature='';
    let drag=null;canvas.onpointerdown=e=>{if(e.button!==0)return;drag=e.clientX;canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(drag!==null){this.angle+=(e.clientX-drag)*.012;drag=e.clientX;}};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(this.faceView?1.35:3.8,Math.min(this.faceView?3.5:7,this.distance+e.deltaY*.003));},{passive:false});
  }
  setView(face){this.faceView=face;this.focusHeight=face?(this.preview?.faceFocus??1.95):(this.preview?.bodyFocus??1.15);this.distance=face?(this.preview?.faceDistance??2.0):(this.preview?.bodyDistance??5.3);}
  setCharacter(character){
    const race=raceDefinition(character?.raceId);if(this.raceId!==race.id){this.raceId=race.id;this.preview=race.preview;this.setView(this.faceView);}
    const definition=classDefinition(character?.classId),equipment=character?.equipment||{weapon:definition.starterWeapon,armor:definition.starterArmor},shown=character?.previewHideHeadgear?{...equipment,head:null}:equipment;
    const signature=JSON.stringify([character?.look,character?.appearance,character?.raceId,character?.classId,shown]);if(signature===this.signature)return;this.signature=signature;
    if(this.character)disposeHumanoid(this.character);
    this.character=createHumanoid('#8c8874',false,character?.look,character?.appearance,{},character?.raceId);this.character.userData.equipment.update(shown);this.scene.add(this.character);
    this.canvas.dataset.raceId=character?.raceId||normalizeIdentity().raceId;this.canvas.dataset.classId=character?.classId||classDefinition().id;this.canvas.dataset.look=character?.look||'hearth';this.canvas.dataset.appearance=JSON.stringify(this.character.userData.appearance);this.canvas.dataset.equipment=JSON.stringify(shown);
  }
  frame(dt){
    const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    if(this.width!==r.width||this.height!==r.height){this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
    this.camera.position.set(0,this.focusHeight+(this.faceView?.2:.55),this.distance);this.camera.lookAt(0,this.focusHeight,0);
    if(this.character)animateHumanoid(this.character,{x:0,z:0,facing:this.angle,jumpHeight:0},dt,{},()=>0);
    this.renderer.render(this.scene,this.camera);
  }
}
