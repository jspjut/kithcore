import * as THREE from 'three';
import {supportBelow} from '../shared/props.js';

const SEGMENTS=96,SIDES=8,TAU=Math.PI*2;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function tube(){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array((SEGMENTS+1)*(SIDES+1)*3),indices=[];
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  for(let i=0;i<SEGMENTS;i++)for(let j=0;j<SIDES;j++){const a=i*(SIDES+1)+j,b=a+SIDES+1;indices.push(a,b,a+1,b,b+1,a+1);}
  geometry.setIndex(indices);return geometry;
}
export class TargetMarker{
  constructor(){
    this.root=new THREE.Group();this.root.name='target-marker';this.root.visible=false;
    const material=(color,opacity)=>new THREE.MeshBasicMaterial({color,opacity,transparent:true,depthWrite:false,depthTest:true,fog:false,toneMapped:false,side:THREE.DoubleSide});
    this.outline=new THREE.Mesh(tube(),material('#15211d',.95));this.ink=new THREE.Mesh(tube(),material('#ffe39a',1));
    // Draw the bright center over its dark silhouette without writing depth;
    // world geometry still occludes both passes normally.
    this.outline.renderOrder=20;this.ink.renderOrder=21;this.root.add(this.outline,this.ink);
    this.cameraPoint=new THREE.Vector3();this.samples=new Float32Array(SEGMENTS+1);this.radius=1.16;this.stroke=0;
  }
  update(target,camera,viewportHeight,playing){
    this.root.visible=!!target&&playing;if(!this.root.visible)return;
    const position=target.object.position;this.cameraPoint.copy(position).applyMatrix4(camera.matrixWorldInverse);
    const depth=-this.cameraPoint.z;if(depth<=camera.near){this.root.visible=false;return;}
    const pixelsPerUnit=viewportHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*depth);
    const base=target.data.type==='warden'?2.32:1.16;
    this.radius=clamp(17/pixelsPerUnit,base,base*1.65);this.stroke=clamp(2.6/pixelsPerUnit,.025,.3);
    this.root.position.copy(position);this.ink.material.color.set(target.kind==='enemy'?'#ffe39a':'#a7ffd1');
    const shape=[position.x,position.y,position.z,this.radius,this.stroke];
    if(this.lastShape&&shape.every((n,i)=>Math.abs(n-this.lastShape[i])<1e-4))return;
    this.lastShape=shape;
    const floor=supportBelow(position.x,position.z,position.y+.1).y,lift=Math.max(0,position.y-floor);
    // Sample each section separately so hills cannot swallow the lower half.
    // Keep the ring at foot height across large drops (tables or a jump).
    for(let i=0;i<=SEGMENTS;i++){
      const angle=i/SEGMENTS*TAU,x=position.x+Math.cos(angle)*this.radius,z=position.z+Math.sin(angle)*this.radius;
      const surface=supportBelow(x,z,floor+.65,0).y,delta=surface-floor;
      this.samples[i]=(Math.abs(delta)<.75?surface:floor)+lift-position.y;
    }
    this.writeTube(this.outline.geometry,this.stroke);this.writeTube(this.ink.geometry,this.stroke*.52);
  }
  writeTube(geometry,width){
    const positions=geometry.attributes.position;let vertex=0;
    for(let i=0;i<=SEGMENTS;i++){
      const angle=i/SEGMENTS*TAU,c=Math.cos(angle),s=Math.sin(angle);
      for(let j=0;j<=SIDES;j++){
        const cross=j/SIDES*TAU,r=this.radius+Math.cos(cross)*width;
        positions.setXYZ(vertex++,c*r,this.samples[i]+this.stroke+.045+Math.sin(cross)*width,s*r);
      }
    }
    positions.needsUpdate=true;geometry.computeBoundingSphere();
  }
  debug(){return {visible:this.root.visible,radius:this.radius,stroke:this.stroke,position:this.root.position.toArray()};}
}
