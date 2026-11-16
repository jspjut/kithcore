import * as THREE from 'three';
const materials=new Map(),geometries=new Map();
export function mat(color,metal=false,glow=false){const key=`${color}:${metal}:${glow}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.48:.9,metalness:metal?.5:0,...(glow?{emissive:color,emissiveIntensity:.3}:{})}));return materials.get(key);}
function geometry(kind){if(!geometries.has(kind)){const g=kind==='box'?new THREE.BoxGeometry(1,1,1):kind==='ball'?new THREE.SphereGeometry(1,12,8):kind==='rock'?new THREE.IcosahedronGeometry(1,1):kind==='cylinder'?new THREE.CylinderGeometry(1,1,1,12):kind==='cone'?new THREE.ConeGeometry(1,1,10):new THREE.TorusGeometry(1,.1,6,20);g.userData.libraryShared=true;geometries.set(kind,g);}return geometries.get(kind);}
export function group(parent,name,x=0,y=0,z=0){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);parent?.add(g);return g;}
export function shape(parent,kind,color,x,y,z,sx,sy=sx,sz=sx,{metal=false,glow=false}={}){const m=new THREE.Mesh(geometry(kind),mat(color,metal,glow));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export const box=(p,c,x,y,z,w,h,d,options)=>shape(p,'box',c,x,y,z,w,h,d,options);
export const ball=(p,c,x,y,z,rx,ry=rx,rz=rx,options)=>shape(p,'ball',c,x,y,z,rx,ry,rz,options);
export const rock=(p,c,x,y,z,rx,ry=rx,rz=rx,options)=>shape(p,'rock',c,x,y,z,rx,ry,rz,options);
export const cylinder=(p,c,x,y,z,r,h,options)=>shape(p,'cylinder',c,x,y,z,r,h,r,options);
export const cone=(p,c,x,y,z,r,h,options)=>shape(p,'cone',c,x,y,z,r,h,r,options);
export function beam(p,c,a,b,r,options){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av),m=cylinder(p,c,...av.clone().add(bv).multiplyScalar(.5).toArray(),r,v.length(),options);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
export function leaf(p,c,x,y,z,s=1){const m=ball(p,c,x,y,z,.11*s,.025*s,.23*s);m.rotation.x=.35;return m;}
export function eyes(p,palette,x,y,z,size=.065){for(const side of[-1,1]){ball(p,palette.light,side*x,y,z,size*1.5,size*1.6,size*.8);ball(p,palette.glow,side*x,y,z+size*.6,size*.7,size*.9,size*.5);ball(p,'#273636',side*x,y,z+size*.95,size*.35,size*.65,size*.2);}}
export function ring(p,c,x,y,z,r,rotation=0){const m=shape(p,'ring',c,x,y,z,r,r,r);m.rotation.x=rotation;return m;}
