import * as THREE from 'three';
import {BUILDINGS,wallParts,buildingAt,segmentHitsBox,entrancePoint} from '/shared/buildings.js';
import {heightAt} from '/shared/terrain.js';
const materials=new Map();
const paint=(color,extra={})=>{const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.95,...extra}));return materials.get(key);};
function box(parent,w,h,d,color,x=0,y=0,z=0,extra={}){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),paint(color,extra));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function batchBoxes(parent,entries,color){if(!entries.length)return;const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),paint(color),entries.length),dummy=new THREE.Object3D();for(const [i,p]of entries.entries()){dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);}
function boundsFor(object){object.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(object);return {minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z};}
const outward={north:{x:0,z:-1},south:{x:0,z:1},west:{x:-1,z:0},east:{x:1,z:0}};
function woodTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');for(let i=0;i<8;i++){c.fillStyle=i%2?'#a18657':'#967a4e';c.fillRect(i*32,0,32,256);c.strokeStyle='#6a593c';c.strokeRect(i*32,0,32,256);c.strokeStyle='#b59b692b';for(let j=0;j<5;j++){c.beginPath();c.moveTo(i*32+5+j*4,0);c.bezierCurveTo(i*32+j*4,85,i*32+12+j*4,170,i*32+5+j*4,256);c.stroke();}}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;}

export class BuildingScene{
 constructor(scene){
  this.scene=scene;this.entries=[];this.current=null;this.floorTexture=woodTexture();
  for(const definition of BUILDINGS)if(!definition.continent)this.build(definition);
  this.light=new THREE.PointLight('#ffd5a0',0,13,2);scene.add(this.light);
 }
 component(entry,group,type,side=null){
  const materials=[],boxes=[];group.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.transparent=true;materials.push(o.material);boxes.push(boundsFor(o));});
  const component={group,type,side,materials,boxes,bounds:boundsFor(group),alpha:1,obstructs:false};entry.components.push(component);return component;
 }
 build(b){
  const root=new THREE.Group(),floorY=heightAt(b.x,b.z);root.position.set(b.x,floorY,b.z);this.scene.add(root);
  const entry={definition:b,root,floorY,components:[],details:new THREE.Group(),roof:new THREE.Group()};root.add(entry.details);root.add(entry.roof);
  const floorMap=this.floorTexture.clone();floorMap.repeat.set(b.width/3,b.depth/3);floorMap.needsUpdate=true;
  const floor=new THREE.Mesh(new THREE.BoxGeometry(b.width,.16,b.depth),new THREE.MeshStandardMaterial({map:floorMap,roughness:.95,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-1}));floor.position.y=-.08;floor.receiveShadow=true;root.add(floor);
  const dir=outward[b.doorSide],horizontal=dir.x===0,edge=horizontal?b.depth/2:b.width/2;
  box(root,horizontal?b.doorWidth+.6:1.4,.1,horizontal?1.4:b.doorWidth+.6,'#99845c',dir.x*(edge+.6),-.05,dir.z*(edge+.6),{polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-1});
  const wallGroups=Object.fromEntries(['north','south','west','east'].map(side=>{const group=new THREE.Group();root.add(group);return [side,group];}));
  for(const part of wallParts(b)){
   const group=wallGroups[part.side];box(group,part.width,part.height,part.depth,b.wallColor||(b.cave?'#727f75':b.capital?'#c9c3ab':'#c1b28b'),part.x,part.bottom+part.height/2,part.z);
   if(part.solid){const across=part.side==='north'||part.side==='south';box(group,across?part.width:.42,.22,across?.42:part.depth,'#756348',part.x,b.wallHeight-.16,part.z);box(group,across?part.width:.38,.18,across?.38:part.depth,'#756348',part.x,.09,part.z);}
  }
  for(const [side,group]of Object.entries(wallGroups)){
   const sideDir=outward[side],alongX=sideDir.x===0,length=alongX?b.width:b.depth,sideEdge=(alongX?b.depth:b.width)/2;
   for(const sign of [-1,1])box(group,.22,b.wallHeight+.1,.22,'#6c5b41',alongX?sign*(length/2-.1):sideDir.x*sideEdge,b.wallHeight/2,alongX?sideDir.z*sideEdge:sign*(length/2-.1));
   if(side===b.doorSide){
    for(const sign of [-1,1])box(group,alongX?.18:.48,b.doorHeight,.48*(alongX?1:0)+.18*(alongX?0:1),'#7a6647',alongX?sign*(b.doorWidth/2+.02):dir.x*edge,b.doorHeight/2,alongX?dir.z*edge:sign*(b.doorWidth/2+.02));
    box(group,alongX?b.doorWidth+.3:.46,.25,alongX?.46:b.doorWidth+.3,'#8d7752',dir.x*edge,b.doorHeight+.08,dir.z*edge);
    if(['workshop','town-inn:0','town-smith:0','town-market:0','town-study:0','lodge'].includes(b.id))this.sign(group,b,edge);
   }else if(!b.cave&&!(b.doors||[]).includes(side)){
    const window=new THREE.Group();window.position.set(sideDir.x*(sideEdge+.19),2.8,sideDir.z*(sideEdge+.19));window.rotation.y=alongX?0:Math.PI/2;group.add(window);box(window,1.2,1.5,.08,'#6c634b');box(window,.99,1.25,.1,'#e7cc91',0,0,.01,{emissive:'#b7843e',emissiveIntensity:.22});box(window,.07,1.3,.13,'#726246');box(window,1.05,.07,.13,'#726246');
   }
  }
  if(b.capital){
   for(const [side,group]of Object.entries(wallGroups)){const horizontal=side==='north'||side==='south',length=horizontal?b.width:b.depth,edge=(horizontal?b.depth:b.width)/2,dir=outward[side],frames=[],panes=[],mullions=[],piers=[];
    for(let offset=-length/2+4;offset<length/2-2;offset+=b.landmark?7:6){if((b.doors||[b.doorSide]).includes(side)&&Math.abs(offset)<b.doorWidth/2+3)continue;
     for(const y of b.wallHeight>=14?[6,11]:[b.wallHeight*.58]){const x=horizontal?offset:dir.x*(edge+.25),z=horizontal?dir.z*(edge+.25):offset;frames.push({x,y,z,w:horizontal?2.1:.28,h:3.1,d:horizontal?.28:2.1});panes.push({x:x+dir.x*.17,y,z:z+dir.z*.17,w:horizontal?1.7:.12,h:2.7,d:horizontal?.12:1.7});mullions.push({x:x+dir.x*.25,y,z:z+dir.z*.25,w:horizontal?.1:.16,h:2.75,d:horizontal?.16:.1});}
     piers.push({x:horizontal?offset+2:dir.x*(edge+.3),y:b.wallHeight/2,z:horizontal?dir.z*(edge+.3):offset+2,w:horizontal?.45:.8,h:b.wallHeight,d:horizontal?.8:.45});
    }
    batchBoxes(group,frames,'#8b927e');batchBoxes(group,panes,b.landmark==='archive'?'#9babb8':'#8faeb3');batchBoxes(group,mullions,'#d4c9a8');batchBoxes(group,piers,'#b0b49d');
    const edgeX=dir.x*edge,edgeZ=dir.z*edge;box(group,horizontal?b.width:.7,.35,horizontal?.7:b.depth,'#dfd4b3',edgeX,b.wallHeight-1.1,edgeZ);
   }
   if(b.landmark==='assembly'){
    const front=wallGroups.south;for(const x of[-20,-8.4,8.4,20]){const column=new THREE.Mesh(new THREE.CylinderGeometry(1,1.15,12,12),paint('#d5d0b5'));column.position.set(x,6,b.depth/2+2);column.castShadow=true;front.add(column);box(front,2.8,.5,2.8,'#b8baa1',x,.25,b.depth/2+2);box(front,2.7,.5,2.7,'#c6c4ab',x,11.75,b.depth/2+2);}
    box(front,46,1.8,5,'#d8cfaf',0,12.7,b.depth/2+2);const crest=new THREE.Mesh(new THREE.TorusGeometry(1.7,.18,8,24),paint('#c5ac70',{metalness:.45}));crest.position.set(0,15,b.depth/2+.35);front.add(crest);
   }
  }
  const rug=box(root,Math.min(2.1,b.doorWidth-.4),.008,b.depth-1.2,'#5a7e70',0,.004,0);rug.castShadow=false;
  for(const furniture of b.furniture)this.furnish(entry,furniture);
  this.roof(entry);
  for(const [side,group]of Object.entries(wallGroups))this.component(entry,group,'wall',side);
  entry.roofBounds=boundsFor(entry.roof);this.entries.push(entry);
 }
 sign(group,b,edge){
  const dir=outward[b.doorSide],canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#514a35';c.fillRect(0,0,512,96);c.strokeStyle='#b69c67';c.lineWidth=6;c.strokeRect(5,5,502,86);c.fillStyle='#ead8ad';c.font='32px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(b.name,256,48,475);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4.2,b.width-.8),.75),new THREE.MeshBasicMaterial({map}));sign.position.set(dir.x*(edge+.22),b.doorHeight+.65,dir.z*(edge+.22));sign.rotation.y=b.doorSide==='north'?Math.PI:b.doorSide==='south'?0:b.doorSide==='east'?Math.PI/2:-Math.PI/2;group.add(sign);
 }
 roof(entry){
  const b=entry.definition,w=b.width/2+.5,d=b.depth/2+.55,h=b.wallHeight,y=h+b.roofRise,positions=[];
  const a=[-w,h,-d],c=[-w,h,d],e=[w,h,-d],f=[w,h,d],r=[0,y,-d],s=[0,y,d];
  for(const triangle of [[a,c,r],[c,s,r],[r,s,e],[s,f,e],[a,r,e],[c,f,s]])for(const v of triangle)positions.push(...v);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const roof=new THREE.Mesh(geometry,paint(b.roofColor||(b.cave?'#6c776e':b.capital?'#4f747a':'#687c5d'),{side:THREE.DoubleSide}));roof.castShadow=true;roof.receiveShadow=true;entry.roof.add(roof);
  if(b.roofStyle&&b.roofStyle!=='gable'){roof.visible=false;const dome=b.roofStyle==='dome',shape=dome?new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2):b.roofStyle==='flat'?new THREE.BoxGeometry(2,1,2):new THREE.ConeGeometry(1,1,b.roofStyle==='crown'?8:6);const cap=new THREE.Mesh(shape,paint(b.roofColor));cap.position.y=h+(dome?0:b.roofStyle==='flat'?.5:b.roofRise/2);cap.scale.set(w,dome?b.roofRise:b.roofStyle==='flat'?1:b.roofRise,d);cap.castShadow=true;entry.roof.add(cap);}
  box(entry.roof,b.width+.2,.18,b.depth+.2,b.cave?'#78837a':'#7d6c4d',0,h+.03,0);
  box(entry.roof,.65,3,.7,'#8b8c76',b.width*.24,h+1.3,b.depth*.16);box(entry.roof,.9,.2,.95,'#a0a18a',b.width*.24,h+2.85,b.depth*.16);
  if(b.capital&&b.landmark){
   const tower=(x,z,r,height)=>{const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.08,height,12),paint('#b1b7a6'));t.position.set(x,h+height/2,z);t.castShadow=true;entry.roof.add(t);for(const band of[.15,.6,.93]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(r*1.07,r*1.07,.5,12),paint('#d3c8a5'));ring.position.set(x,h+height*band,z);entry.roof.add(ring);}for(let i=0;i<8;i++){const a=i*Math.PI/4;const window=box(entry.roof,.8,2.8,.15,'#64858c',x+Math.sin(a)*r,h+height*.76,z+Math.cos(a)*r);window.rotation.y=a;}const cap=new THREE.Mesh(new THREE.ConeGeometry(r*1.25,Math.min(10,height*.4),12),paint('#4f747a'));cap.position.set(x,h+height+Math.min(5,height*.2),z);entry.roof.add(cap);};
   if(b.landmark==='assembly'){for(const side of[-1,1])tower(side*(b.width/2-6),-b.depth/2+7,4.4,37);tower(0,-18,7,44);}
   else if(b.landmark==='archive')tower(-b.width/2+6,-b.depth/2+6,4.5,30);
   else if(b.landmark==='foundry'){tower(b.width/2-5,-b.depth/2+5,4,29);const bell=new THREE.Mesh(new THREE.CylinderGeometry(1.8,2.8,4,12),paint('#b49b59',{metalness:.55}));bell.position.set(0,h+4,-5);entry.roof.add(bell);}
   else for(const side of[-1,1])tower(side*(b.width/2-3),-b.depth/2+4,2.6,9);
   const banner=box(entry.roof,2.5,8,.2,b.landmark==='archive'?'#74678c':'#426575',-b.width/2+3,h+4,b.depth/2+.35);banner.castShadow=false;
  }
  const lantern=new THREE.Group();entry.root.add(lantern);lantern.position.set(-b.width/2+.7,3.1,0);box(lantern,.35,.65,.35,'#d5bb7c',0,0,0,{emissive:'#d39b43',emissiveIntensity:.45});box(lantern,.45,.08,.45,'#716245',0,.38,0);box(lantern,.45,.08,.45,'#716245',0,-.38,0);this.component(entry,lantern,'decoration');
 }
 furnish(entry,p){
  const group=new THREE.Group();group.position.set(p.x,0,p.z);entry.details.add(group);const w=p.width,d=p.depth,h=p.height;
  if(p.type==='bed'){
   box(group,w,.35,d,'#745b3f',0,.3,0);box(group,w-.1,.2,d-.1,'#b6af8b',0,.58,0);box(group,w-.13,.12,d*.65,'#668275',0,.74,d*.12);box(group,w-.25,.16,.45,'#dfd6b0',0,.76,-d*.34);box(group,w,.95,.13,'#6f5a40',0,.48,-d/2+.03);
  }else if(p.type==='shelf'){
   box(group,w,h,.08,'#706044',0,h/2,-d/2+.03);for(const x of [-w/2+.05,w/2-.05])for(const z of [-d/2+.05,d/2-.05])box(group,.09,h,.09,'#6c5b40',x,h/2,z);
   box(group,w,.12,d,'#95815a',0,h-.06,0);
   for(let shelf=0;shelf<3;shelf++){
    const y=.25+shelf*(h-.45)/3;box(group,w,.12,d,'#95815a',0,y,0);
    for(let i=0;i<3;i++){const alongX=w>d,x=alongX?(i-1)*w*.25:0,z=alongX?0:(i-1)*d*.25;box(group,alongX?.19:w*.65,.28,alongX?d*.65:.19,['#85936d','#a58a5a','#738c86'][i],x,y+.2,z);}
   }
  }else if(p.type==='crates'){
   for(let i=0;i<2;i++){const x=(i-.5)*w*.48;box(group,w*.46,h*(i?1:.65),d,'#937248',x,h*(i?1:.65)/2,0);box(group,.09,h*(i?1:.65),d+.04,'#c0a36b',x,h*(i?1:.65)/2,0);}
  }else{
   box(group,w,.16,d,'#9e8255',0,h-.08,0);for(const x of [-w/2+.12,w/2-.12])for(const z of [-d/2+.12,d/2-.12])box(group,.13,h-.15,.13,'#756144',x,(h-.15)/2,z);
   if(p.type==='counter')box(group,w-.08,h*.65,d-.08,'#7e6946',0,h*.4,0);
   box(group,.45,.06,.4,'#d5c69a',0,h+.03,0);box(group,.17,.27,.17,'#718e78',w*.26,h+.135,0);
  }
  this.component(entry,group,'furniture');
 }
 update(p,camera,focus,dt,playing){
  const center=p||focus;
  for(const b of BUILDINGS)if(b.continent&&Math.hypot(b.x-center.x,b.z-center.z)<420&&!this.entries.some(e=>e.definition.id===b.id))this.build(b);
  this.entries=this.entries.filter(entry=>{if(!entry.definition.continent||Math.hypot(entry.definition.x-center.x,entry.definition.z-center.z)<700)return true;entry.root.removeFromParent();const shared=new Set(materials.values());entry.root.traverse(o=>{o.geometry?.dispose();if(o.material&&!shared.has(o.material)){if(o.material.map&&o.material.map!==this.floorTexture)o.material.map.dispose();o.material.dispose();}});return false;});
  const inside=playing&&p?buildingAt(p.x,p.z):null;this.current=inside;
  for(const entry of this.entries){
   entry.root.visible=Math.hypot(center.x-entry.definition.x,center.z-entry.definition.z)<(entry.definition.capital?400:85);if(!entry.root.visible)continue;
   const own=inside?.id===entry.definition.id,roofBlocks=playing&&segmentHitsBox(focus,camera.position,entry.roofBounds);entry.roof.visible=!(own||roofBlocks);
   entry.details.visible=!!p&&(own||roofBlocks||Math.hypot(p.x-entry.definition.x,p.z-entry.definition.z)<12);
   for(const component of entry.components){
    const side=component.side&&outward[component.side],facingCamera=own&&side&&(side.x*(camera.position.x-focus.x)+side.z*(camera.position.z-focus.z)>0);
    component.obstructs=!!playing&&(!!facingCamera||segmentHitsBox(focus,camera.position,component.bounds)&&component.boxes.some(box=>segmentHitsBox(focus,camera.position,box)));const target=component.obstructs ? .08 : 1;
    component.alpha=THREE.MathUtils.lerp(component.alpha,target,1-Math.exp(-dt*22));if(Math.abs(component.alpha-target)<.002)component.alpha=target;
    for(const mat of component.materials){mat.opacity=component.alpha;mat.depthWrite=component.alpha>.995;}
    component.group.traverse(o=>{if(o.isMesh)o.castShadow=component.alpha>.9;});
   }
  }
  this.light.intensity=inside?8:0;if(inside)this.light.position.set(inside.x,heightAt(inside.x,inside.z)+3.8,inside.z);
 }
 labelVisible(camera,point){
  for(const entry of this.entries){if(entry.roof.visible&&segmentHitsBox(camera,point,entry.roofBounds))return false;for(const c of entry.components)if(c.type==='wall'&&c.alpha>.5&&segmentHitsBox(camera,point,c.bounds)&&c.boxes.some(box=>segmentHitsBox(camera,point,box)))return false;}
  return true;
 }
 debug(){const entry=this.entries.find(e=>e.definition.id===this.current?.id);return {id:this.current?.id||null,name:this.current?.name||null,roofHidden:entry?!entry.roof.visible:false,floor:entry?.floorY??null,wallHeight:this.current?.wallHeight??null,fadedWalls:entry?.components.filter(c=>c.type==='wall'&&c.alpha<.2).length||0,opaqueObstructions:entry?.components.filter(c=>c.obstructs&&c.alpha>.25).length||0,entries:this.entries.map(e=>({id:e.definition.id,door:entrancePoint(e.definition),roofVisible:e.roof.visible}))};}
}
