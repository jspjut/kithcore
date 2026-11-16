import * as THREE from 'three';
import {heightAt,TERRAIN_SIZE,TERRAIN_SEGMENTS} from '../shared/terrain.js';
import {nearbyColliders,colliderTop} from '../shared/props.js';

export const GROUND_EFFECT_LIFT=.055;
const CELL=TERRAIN_SIZE/TERRAIN_SEGMENTS,HALF=TERRAIN_SIZE/2;

// Match the renderer's grid AND triangle diagonals, rather than putting a fan
// over sampled heights: the interior of a large fan still cuts through hills.
export function groundAreaGeometry(x,z,radius){
 const minX=Math.floor((x-radius+HALF)/CELL),maxX=Math.ceil((x+radius+HALF)/CELL),minZ=Math.floor((z-radius+HALF)/CELL),maxZ=Math.ceil((z+radius+HALF)/CELL),width=maxX-minX+1,positions=[],indices=[];
 for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){
  const wx=ix*CELL-HALF,wz=iz*CELL-HALF;positions.push(wx,heightAt(wx,wz)+GROUND_EFFECT_LIFT,wz);
 }
 for(let iz=0;iz<maxZ-minZ;iz++)for(let ix=0;ix<maxX-minX;ix++){const a=iz*width+ix,b=a+width;indices.push(a,b,a+1,b,b+1,a+1);}
 const terrainVertices=positions.length/3;
 // Draw on the tops of walkable props too. The terrain layer beneath each
 // prop remains depth-occluded; roofs, walls and characters still occlude us.
 for(const c of nearbyColliders(x,z,radius+CELL)){
  if(!c.standable||c.maxX<x-radius||c.minX>x+radius||c.maxZ<z-radius||c.minZ>z+radius)continue;
  const first=positions.length/3;
  if(c.r!==undefined){
   const sides=c.id==='hollow-altar'?10:32;positions.push(c.x,colliderTop(c,c.x,c.z)+GROUND_EFFECT_LIFT,c.z);
   for(let i=0;i<=sides;i++){const angle=i/sides*Math.PI*2,wx=c.x+Math.sin(angle)*c.r,wz=c.z+Math.cos(angle)*c.r;positions.push(wx,colliderTop(c,wx,wz)+GROUND_EFFECT_LIFT,wz);if(i)indices.push(first,first+i,first+i+1);}
  }else{
   for(const[wx,wz]of [[c.minX,c.minZ],[c.minX,c.maxZ],[c.maxX,c.minZ],[c.maxX,c.maxZ]])positions.push(wx,colliderTop(c,wx,wz)+GROUND_EFFECT_LIFT,wz);
   indices.push(first,first+1,first+2,first+1,first+3,first+2);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeBoundingSphere();geometry.userData.terrainVertices=terrainVertices;return geometry;
}

export class GroundArea extends THREE.Mesh{
 constructor({x=0,z=0,radius=1,maxRadius=radius,innerRatio=0,color='#e77253',opacity=.4}={}){
  const material=new THREE.ShaderMaterial({
   uniforms:{uCenter:{value:new THREE.Vector2(x,z)},uRadius:{value:radius},uInnerRatio:{value:innerRatio},uColor:{value:new THREE.Color(color)},uOpacity:{value:opacity}},
   vertexShader:'varying vec2 vGroundXZ; void main(){vGroundXZ=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`uniform vec2 uCenter;uniform float uRadius;uniform float uInnerRatio;uniform vec3 uColor;uniform float uOpacity;varying vec2 vGroundXZ;
    void main(){float distanceFromCenter=length(vGroundXZ-uCenter);float aa=max(fwidth(distanceFromCenter),.006);
     float mask=1.0-smoothstep(uRadius-aa,uRadius+aa,distanceFromCenter);
     if(uInnerRatio>0.0)mask*=smoothstep(uRadius*uInnerRatio-aa,uRadius*uInnerRatio+aa,distanceFromCenter);
     if(mask<.001)discard;
     float rim=smoothstep(uRadius-.16-aa,uRadius-.07,distanceFromCenter);
     float strength=uInnerRatio>0.0?1.0:mix(.65,1.5,rim);
     gl_FragColor=vec4(uColor,min(1.0,uOpacity*strength)*mask);
     #include <colorspace_fragment>
    }`,
   transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,fog:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  super(groundAreaGeometry(x,z,maxRadius),material);this.name='ground-area';this.renderOrder=12;this.coverage=maxRadius;
 }
 place(x,z,radius=this.material.uniforms.uRadius.value){
  const uniforms=this.material.uniforms;
  if(uniforms.uCenter.value.x!==x||uniforms.uCenter.value.y!==z||radius>this.coverage){
   const coverage=Math.max(radius,this.coverage);this.geometry.dispose();this.geometry=groundAreaGeometry(x,z,coverage);this.coverage=coverage;uniforms.uCenter.value.set(x,z);
  }
  uniforms.uRadius.value=radius;return this;
 }
 setRadius(radius){return this.place(this.material.uniforms.uCenter.value.x,this.material.uniforms.uCenter.value.y,radius);}
 setOpacity(opacity){this.material.uniforms.uOpacity.value=opacity;return this;}
 debug(){const u=this.material.uniforms;return {visible:this.visible,x:u.uCenter.value.x,z:u.uCenter.value.y,radius:u.uRadius.value,innerRatio:u.uInnerRatio.value,vertices:this.geometry.attributes.position.count,terrainVertices:this.geometry.userData.terrainVertices,lift:GROUND_EFFECT_LIFT,depthTest:this.material.depthTest};}
}
