import * as THREE from 'three';
import {definition} from '../shared/definition.js';
import {GATHERABLES,ENEMY_TYPES} from '../shared/content.js';
import {READABLES} from '../shared/readables.js';
import {MAILBOXES} from '../shared/mail.js';
import {heightAt,TERRAIN_SIZE,TERRAIN_SEGMENTS} from '../shared/terrain.js';
import {REGIONS,landscapeAt,TRAILS,HUBS,trailDistance} from '../shared/landscape.js';
import {WORLD_BOUNDS} from '../shared/zone-layout.js';
import {BuildingScene} from './buildings.js';
import {CreatureAnimator} from './animation.js';
import {mesh,box,ball,cylinder} from './scene-primitives.js';

// Only scenery and creature art live here. Camera, picking, nameplates, maps,
// targeting, prediction and all interaction windows use the shared client.
export const worldPresentation={
  buildWorld(){
    this.scene.background.set('#a5c8bf');this.scene.fog.color.set('#a5c8bf');
    const geometry=new THREE.PlaneGeometry(TERRAIN_SIZE,TERRAIN_SIZE,TERRAIN_SEGMENTS,TERRAIN_SEGMENTS);geometry.rotateX(-Math.PI/2);
    const positions=geometry.attributes.position,colors=[];
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,heightAt(x,z));
      const color=new THREE.Color(landscapeAt(x,z).color);color.multiplyScalar(.96+.04*Math.sin(x*.7)*Math.cos(z*.5));colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));ground.receiveShadow=true;this.scene.add(ground);
    this.buildings=new BuildingScene(this.scene);
    this.terrain={update(){},debug:()=>({chunks:1,vertices:positions.count})};
    const marker=mesh(new THREE.CylinderGeometry(1.3,1.3,.12,32),'#5ac8dc',this.scene,0,heightAt(0,-8)+.06,-8,{emissive:'#245a69'});
    for(const c of definition.colliders)box(c.maxX-c.minX,c.maxY-c.minY,c.maxZ-c.minZ,'#ad8557',this.scene,(c.maxX+c.minX)/2,(c.maxY+c.minY)/2,(c.maxZ+c.minZ)/2);
    // Small overlapping trail disks follow the same height function as actors.
    const trailVertices=[];
    for(const trail of TRAILS)for(let i=1;i<trail.length;i++){
      const [ax,az]=trail[i-1],[bx,bz]=trail[i],steps=Math.ceil(Math.hypot(bx-ax,bz-az)/1.1);
      for(let j=0;j<steps;j++){const t=j/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
        for(let k=0;k<8;k++){
          for(const [px,pz]of [[x,z],[x+Math.cos((k+1)*Math.PI/4)*1.05,z+Math.sin((k+1)*Math.PI/4)*1.05],[x+Math.cos(k*Math.PI/4)*1.05,z+Math.sin(k*Math.PI/4)*1.05]])trailVertices.push(px,heightAt(px,pz)+.035,pz);
        }}
    }
    const pathGeometry=new THREE.BufferGeometry();pathGeometry.setAttribute('position',new THREE.Float32BufferAttribute(trailVertices,3));pathGeometry.computeVertexNormals();
    const paths=new THREE.Mesh(pathGeometry,new THREE.MeshStandardMaterial({color:'#b5ad87',roughness:1}));paths.receiveShadow=true;this.scene.add(paths);
    for(const hub of HUBS){
      const {x,z}=hub,y=heightAt(x,z),group=new THREE.Group();group.position.set(x,y,z);this.scene.add(group);
      // Open fabric shelters have no enclosed walls or hidden collision.
      for(const dx of [-3,3])cylinder(.1,.13,3.8,'#826b50',group,dx,1.9,4);
      const roof=box(7,.2,4,hub.color,group,0,3.7,4);roof.rotation.z=.08;
      cylinder(.65,.9,.25,'#777465',group,0,.12,0);ball(.32,'#e6b364',group,0,.4,0);
      box(2,.35,.65,'#91785b',group,-3,.45,0);box(2,.35,.65,'#91785b',group,3,.45,0);
    }
    const avoid=[...definition.npcs,...definition.gatherables,...definition.mailboxes,...definition.readables,...definition.enemySpawns,...definition.landmarks];
    // Fixed scatter is reproducible and keeps all authored interaction sites clear.
    for(let i=0;i<165;i++){
      const x=Math.sin(i*127.1+8)*73,z=Math.sin(i*311.7+19)*73,region=landscapeAt(x,z);
      if(trailDistance(x,z)<3.5||avoid.some(p=>Math.hypot(p.x-x,p.z-z)<5))continue;
      const y=heightAt(x,z),group=new THREE.Group();group.position.set(x,y,z);this.scene.add(group);
      if(region.id==='quarry'||region.id==='ridge'){
        const rock=ball(1+(i%3)*.35,region.id==='quarry'?'#c4bda5':'#929384',group,0,.6,0,1);rock.scale.set(1,.7,1.2);
      }else if(region.id==='wetlands'){
        for(let j=0;j<4;j++){cylinder(.025,.04,1.6,'#9d9866',group,j*.22,.8,0);ball(.09,'#6b664c',group,j*.22,1.6,0);}
      }else{
        cylinder(.2,.3,3.3,'#806d50',group,0,1.65,0);const crown=ball(region.id==='grove'?3.2:2.4,region.id==='grove'?'#476f56':'#62845b',group,0,4.3,0,2);crown.scale.y=region.id==='grove'?1.25:1;
      }
    }
    // Reed pools are shallow decorative basins: no swimming system is implied.
    for(const [x,z,r]of [[-9,58,4.2],[12,49,3.5],[-16,47,2.6]]){
      const pool=mesh(new THREE.CircleGeometry(r,32),'#70a9af',this.scene,x,heightAt(x,z)+.04,z,{transparent:true,opacity:.8});pool.rotation.x=-Math.PI/2;pool.castShadow=false;
    }
    for(const [x,z]of [[38,-59],[43,-64],[58,-11]]){const y=heightAt(x,z);for(let i=0;i<3;i++)ball(.8-i*.18,'#c2bba3',this.scene,x,y+.4+i*.55,z,1);}
    for(const g of [...GATHERABLES,...READABLES,...MAILBOXES]){
      const o=new THREE.Group();o.position.set(g.x,heightAt(g.x,g.z),g.z);this.scene.add(o);
      if(g.type==='mailbox'){cylinder(.1,.13,1.2,'#796448',o,0,.6,0);box(1.2,.8,.8,'#5b7f8b',o,0,1.6,0);box(.6,.07,.03,'#253c44',o,0,1.65,.42);}
      else if(g.storyId){cylinder(.09,.14,.8,'#796448',o,0,.4,0);box(1.1,.12,.7,'#786344',o,0,.86,0);box(.9,.04,.55,'#e5d9b9',o,0,.96,0);}
      else{for(let i=0;i<5;i++){const leaf=ball(.23,'#8eb58b',o,Math.sin(i*1.26)*.25,.3,Math.cos(i*1.26)*.25);leaf.scale.set(.6,1.5,.4);}ball(.12,'#f0d696',o,0,.65,0);}
      this.gathers.set(g.id,{object:o,data:g});
    }
  },
  creature(type,definition=ENEMY_TYPES[type]){
    const o=new THREE.Group(),model=new THREE.Group(),head=new THREE.Group();o.add(model);model.add(head);
    const body=ball(.8,definition.color||'#98c47b',model,0,.55,0,2);body.scale.y=.7;
    for(const x of [-.22,.22])ball(.07,'#294331',head,x,.7,.64);
    o.userData.creature={model,head,legs:[],arms:[],quadruped:false};o.userData.animator=new CreatureAnimator();return o;
  },
  animateCreature(o,pose,dt,data){const rig=o.userData.creature,a=o.userData.animator.step(pose,dt,{dead:data.hp<=0,windup:false});o.userData.animation=a;rig.model.position.y=a.bob;rig.head.rotation.x=a.head;},
  updateWorld(){},
  poolDebug(){return {frogs:0};},
  drawMapBackground(){
    const layer=document.createElement('canvas');layer.width=layer.height=1600;const c=layer.getContext('2d'),b=WORLD_BOUNDS,s=1600/(b.maxX-b.minX),point=(x,z)=>[(x-b.minX)*s,(z-b.minZ)*s];
    for(let px=0;px<1600;px+=10)for(let pz=0;pz<1600;pz+=10){c.fillStyle=landscapeAt(b.minX+px/s,b.minZ+pz/s).color;c.fillRect(px,pz,10,10);}
    c.strokeStyle='#d0bf92';c.lineWidth=2*s;c.lineJoin='round';for(const trail of TRAILS){c.beginPath();trail.forEach(([x,z],i)=>c[i?'lineTo':'moveTo'](...point(x,z)));c.stroke();}
    c.fillStyle='#e9dfb8';c.font='bold 28px sans-serif';c.textAlign='center';for(const r of REGIONS)c.fillText(r.name,...point(r.x,r.z+12));
    c.fillStyle='#e8cb90';for(const h of HUBS){c.beginPath();c.arc(...point(h.x,h.z),1.4*s,0,Math.PI*2);c.fill();}
    this.mapBackground=layer;
  }
};
