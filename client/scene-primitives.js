import * as THREE from 'three';
const UP=new THREE.Vector3(0,1,0);
let seed = 7123;
function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const mats = new Map();
function material(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: false, ...extra }));
  return mats.get(key);
}
function mesh(geo, color, parent, x=0,y=0,z=0, extra={}) {
  const o=new THREE.Mesh(geo,material(color,extra));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
const box=(w,h,d,color,p,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),color,p,x,y,z);
const ball=(r,color,p,x,y,z,detail=1)=>mesh(new THREE.IcosahedronGeometry(r,detail),color,p,x,y,z);
const cylinder=(r1,r2,h,color,p,x,y,z,n=7)=>mesh(new THREE.CylinderGeometry(r1,r2,h,n),color,p,x,y,z);
function beam(a,b,r,color,p) {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);
  const o=cylinder(r,r*1.15,v.length(),color,p,...av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(UP,v.normalize());return o;
}

export {rand,material,mesh,box,ball,cylinder,beam};
