import * as THREE from 'three';
import {ball} from './asset-library/primitives.js';
export function racePalette(id,palette){if(id==='harefolk')palette.skin='#'+new THREE.Color(palette.skin).lerp(new THREE.Color('#d8cdb8'),.35).getHexString();}
export function addRaceTraits(r,id,p){if(id!=='harefolk')return;for(const side of [-1,1]){const ear=ball(r.head,p.leaf,side*.17,.46,-.025,.105,.43,.075);ear.rotation.z=side*-.14;const inner=ball(r.head,p.trim,side*.17,.46,.043,.052,.31,.018);inner.rotation.z=side*-.14;}ball(r.body,p.leaf,0,1,-.39,.16,.17,.15);}
