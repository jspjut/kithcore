import * as THREE from 'three';
const materials=new Map();
function mat(color,metal=false){const key=`${color}:${metal}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.5:.9,metalness:metal?.6:0}));return materials.get(key);}
const part=()=>new THREE.Group();
function mesh(p,g,c,x=0,y=0,z=0,metal=false){const n=new THREE.Mesh(g,mat(c,metal));n.position.set(x,y,z);p.add(n);return n;}
const box=(p,c,x,y,z,w,h,d,m=false)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z,m);
const tube=(p,c,x,y,z,r,h,m=false)=>mesh(p,new THREE.CylinderGeometry(r,r,h,8),c,x,y,z,m);
const cone=(p,c,x,y,z,r,h,m=false)=>mesh(p,new THREE.ConeGeometry(r,h,6),c,x,y,z,m);
const gem=(p,c,x,y,z,r=.07)=>mesh(p,new THREE.OctahedronGeometry(r),c,x,y,z,true);
function panel(p,c,points,depth=.035,z=0,metal=false){const shape=new THREE.Shape();points.forEach(([x,y],i)=>shape[i?'lineTo':'moveTo'](x,y));shape.closePath();return mesh(p,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1}),c,0,0,z,metal);}
function beam(p,c,a,b,r=.025,m=false){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av),n=tube(p,c,0,0,0,r,d.length(),m);n.position.copy(av.add(bv).multiplyScalar(.5));n.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return n;}
// Ten authored profiles change construction, not just surface ornaments.
const profiles=[
 {width:.29,hem:.18,collar:0,pad:.16,flaps:2,back:0},
 {width:.34,hem:.36,collar:.06,pad:.22,flaps:1,back:1},
 {width:.3,hem:.52,collar:.12,pad:.2,flaps:3,back:2},
 {width:.32,hem:.24,collar:.04,pad:.27,flaps:2,back:3},
 {width:.35,hem:.6,collar:.15,pad:.3,flaps:4,back:4},
 {width:.31,hem:.4,collar:.18,pad:.24,flaps:3,back:5},
 {width:.36,hem:.3,collar:.1,pad:.33,flaps:2,back:6},
 {width:.325,hem:.65,collar:.08,pad:.28,flaps:1,back:7},
 {width:.345,hem:.48,collar:.22,pad:.31,flaps:5,back:8},
 {width:.37,hem:.56,collar:.25,pad:.35,flaps:3,back:9}
];
function motif(p,a,index,x,y,z,scale=1){
 const m=['mail','plate'].includes(a.armorType),c=a.trim;
 if(index===0)box(p,c,x,y,z,.12*scale,.045*scale,.035,m);
 if(index===1){const n=tube(p,c,x,y,z,.08*scale,.025,m);n.rotation.x=Math.PI/2;}
 if(index===2)panel(p,c,[[x-.1*scale,y+.07*scale],[x+.1*scale,y+.07*scale],[x,y-.13*scale]],.03,z,m);
 if(index===3)for(const side of[-1,1])box(p,c,x,y,z,.035*scale,.26*scale,.03,m).rotation.z=side*.65;
 if(index===4)for(let j=0;j<3;j++)box(p,c,x,y+(j-1)*.055*scale,z,.22*scale,.028*scale,.03,m);
 if(index===5)for(let j=-1;j<=1;j++)box(p,c,x+j*.06*scale,y,z,.025*scale,.25*scale,.04,m).rotation.z=j*.15;
 if(index===6)for(const side of[-1,1])panel(p,c,[[x,y],[x+side*.2*scale,y+.12*scale],[x+side*.14*scale,y-.08*scale]],.03,z,m);
 if(index===7){box(p,c,x-.06*scale,y,z,.04*scale,.25*scale,.03,m).rotation.z=.3;gem(p,c,x+.06*scale,y,z,.055*scale);}
 if(index===8)for(let j=0;j<4;j++){const n=box(p,c,x+Math.sin(j*Math.PI/2)*.09*scale,y+Math.cos(j*Math.PI/2)*.09*scale,z,.05*scale,.08*scale,.03,m);n.rotation.z=-j*Math.PI/2;}
 if(index===9){for(let j=-1;j<=1;j++)cone(p,c,x+j*.07*scale,y+.05,z,.035*scale,(.2-Math.abs(j)*.04)*scale,m);}
}
export function progressionArmorParts(a){
 const i=a.shapeTier-1,f=profiles[i];if(!f)throw Error('Unknown armor shape tier');
 const cloth=a.armorType==='cloth',leather=a.armorType==='leather',mail=a.armorType==='mail',metal=mail||a.armorType==='plate',p=part(),parts={};
 if(a.slot==='head'){
  const height=[.19,.24,.29,.22,.31,.27,.25,.33,.3,.35][i];
  if(cloth||leather){panel(p,a.main,[[-.29,-.16],[-.31,height*.6],[-.16,height],[i===7?.2:0,height+.06],[.25,height*.75],[.3,-.16],[.2,-.08],[.18,.08],[-.18,.08],[-.2,-.08]],.15,-.16);box(p,a.main,0,height*.4,-.17,.48,height*.8,.15);}
  else{const cap=mesh(p,new THREE.SphereGeometry(.285,10,6,0,Math.PI*2,0,Math.PI*.52),a.main,0,.05,-.03,true);cap.scale.y=.8+height;for(const side of[-1,1]){const cheek=box(p,a.main,side*.25,-.06,.04,.055,.15+i*.012,.17,true);cheek.rotation.z=side*(i%3-1)*.12;}if([2,4,5,8].includes(i))box(p,a.trim,0,-.04,.26,.04,.17,.04,true);if([3,6,9].includes(i))panel(p,a.trim,[[-.24,.1],[0,.18],[.24,.1],[.18,-.03],[-.18,-.03]],.025,.245,true);}
  if(i===1||i===4){const brim=tube(p,a.main,0,.01,0,.34+i*.008,.035,metal);brim.scale.z=.85;}
  if(i===6||i===9)for(const side of[-1,1])panel(p,a.trim,[[side*.2,.12],[side*.4,.36],[side*.31,.02]],.035,-.09,metal);
  motif(p,a,i,0,height+.03,.05,.85);parts.head=p;
 }else if(a.slot==='armor'){
  const torso=mesh(p,new THREE.CylinderGeometry(f.width,.27,.7,cloth?10:6),a.main,0,1.26,0,metal);torso.scale.z=.87;
  if(cloth){const tabard=i%3!==1;for(const side of[-1,1]){const thigh=part();const w=(tabard?.24:.34),h=f.hem+.15;panel(thigh,a.main,[[-w/2,0],[w/2,0],[w*.6,-h],[i%2?0:-w*.5,-h+.08]],.04,.19);box(thigh,a.detail,0,-h*.5,-.18,w,h,.04);parts[side<0?'leftThigh':'rightThigh']=thigh;}if([1,4,7].includes(i))panel(p,a.cloth,[[-.4,1.5],[.4,1.5],[.31,1.05],[-.31,1.05]],.05,.2);}
  else if(leather){for(const side of[-1,1])box(p,a.detail,side*.22,1.27,.21,.12,.48,.1);const strap=box(p,a.trim,0,1.3,.285,.055,.62,.03);strap.rotation.z=(i%2?1:-1)*(.35+i*.04);if(i>=4)for(const side of[-1,1]){const flap=box(p,a.main,side*.22,.82,.16,.18,f.hem,.06);flap.rotation.z=side*.16;}}
  else if(mail){const rows=2+i%4,cols=4;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const n=panel(p,(x+y)%2?a.trim:a.main,[[-.055,.05],[.055,.05],[.05,-.03],[0,-.08],[-.05,-.03]],.025,.26,true);n.position.x=(x-1.5)*.115+(y%2)*.018;n.position.y=1.5-y*.115;}for(const side of[-1,1])box(p,a.detail,side*.19,1.05,.22,.14,f.hem,.06);}
  else{panel(p,a.main,[[-f.width*.85,1.5],[0,1.61],[f.width*.85,1.5],[f.width*.7,1.07],[0,1.02],[-f.width*.7,1.07]],.12,.17,true);for(let j=0;j<2+i%3;j++)box(p,a.trim,0,1.1-j*.065,.265,.46-j*.035,.045,.04,true);for(const side of[-1,1]){const plate=box(p,a.main,side*.22,.87,.17,.22,f.hem*.65,.065,true);plate.rotation.z=side*.15;}}
  if(f.collar)for(const side of[-1,1])box(p,a.trim,side*.19,1.58+f.collar*.3,-.08,.13,f.collar,.12,metal).rotation.z=-side*.3;
  motif(p,a,i,0,1.34,.31,1);
  for(const side of[-1,1]){const upper=part(),lower=part();tube(upper,a.main,0,-.15,0,.13,.3,metal);tube(lower,a.detail,0,-.14,0,.105,.28,metal);parts[side<0?'leftSleeve':'rightSleeve']=upper;parts[side<0?'leftForearm':'rightForearm']=lower;}parts.torso=p;
 }else if(a.slot==='shoulders'){
  for(const side of[-1,1]){const pad=part(),extent=f.pad;if(cloth){const drape=mesh(pad,new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI*.58),a.main,0,.015,0);drape.scale.set(extent,.11+(i%3)*.025,.23);panel(pad,a.cloth,[[-extent,.01],[extent,.01],[extent*.7,-.15],[-extent*.7,-.15]],.025,.14);}else{panel(pad,a.main,[[-extent,.04],[0,.13+(i%3)*.035],[extent,.04],[extent*.8,-.1-(i%2)*.06],[-extent*.8,-.09]],leather?.19:.32,leather?-.09:-.16,metal);}if([2,4,5,8].includes(i))for(let j=0;j<2+i%2;j++)box(pad,a.trim,side*j*.07,-j*.045,.02,.26,.04,.31,metal);if([6,9].includes(i))panel(pad,a.trim,[[0,.06],[side*.34,.32],[side*.28,-.08]],.17,-.08,metal);if(i===7)pad.rotation.z=side*.18;motif(pad,a,i,0,.11,.17,.7);parts[side<0?'leftSleeve':'rightSleeve']=pad;}
 }else if(a.slot==='hands'){
  for(const side of[-1,1]){const glove=part(),h=.14+(i%4)*.035;box(glove,a.main,0,-.29,.01,.19,h,.2,metal);tube(glove,a.detail,0,-.16,0,.113,.13+(i%3)*.04,metal);if(metal)panel(glove,a.trim,[[-.09,-.19],[.09,-.19],[.11,-.36],[0,-.42],[-.11,-.36]],.035,.1,true);motif(glove,a,i,0,-.26,.13,.6);parts[side<0?'leftHand':'rightHand']=glove;}
 }else if(a.slot==='waist'){
  const belt=tube(p,a.main,0,.94,0,.3,.08+(i%3)*.03,metal);belt.scale.z=.94;for(let j=0;j<f.flaps;j++){const x=(j-(f.flaps-1)/2)*.14;panel(p,a.main,[[x-.07,.9],[x+.07,.9],[x+.09,.68-(i%3)*.05],[x,.63-(i%3)*.05],[x-.09,.68-(i%3)*.05]],.035,.23,metal);}if(leather)for(const side of[-1,1])box(p,a.detail,side*.33,.88,.05,.14,.18,.15);motif(p,a,i,0,.94,.31,.7);parts.torso=p;
 }else if(a.slot==='legs'){
  for(const side of[-1,1]){const thigh=part(),shin=part();if(cloth){tube(thigh,a.main,0,-.21,0,.12,.43);tube(shin,a.main,0,-.2,0,.1,.4);}else{box(thigh,a.main,0,-.21,0,.23+(i%3)*.01,.43,.26,metal);box(shin,a.main,0,-.2,0,.2,.4,.23,metal);}if(!cloth)panel(shin,a.trim,[[-.095,-.03],[0,.02+i*.003],[.095,-.03],[.075,-.35],[-.075,-.35]],.025,.13,metal);motif(thigh,a,i,0,-.15,.145,.75);parts[side<0?'leftThigh':'rightThigh']=thigh;parts[side<0?'leftShin':'rightShin']=shin;}
 }else if(a.slot==='feet'){
  for(const side of[-1,1]){const boot=part(),toe=.29+(i%4)*.035;box(boot,a.main,0,-.015,.08,.25,cloth?.095:.15,.35,metal);if(!cloth)panel(boot,a.trim,[[-.12,-.01],[.12,-.01],[i%2?.06:0,.08+i*.005]],.09,toe-.1,metal);tube(boot,a.main,0,.09,0,.125,(cloth?.1:.16)+(i%3)*.04,metal);motif(boot,a,i,0,.12,.13,.6);parts[side<0?'leftFoot':'rightFoot']=boot;}
 }else if(a.slot==='back'){
  const ends=[[-.38,.68],[-.25,.52],[0,.6],[.25,.52],[.38,.68]],outlines=[[[0,.65]],[[0,.48]],ends,[[.32,.55],[0,.73],[-.32,.55]],[[.4,.5],[.15,.55],[0,.44],[-.15,.55],[-.4,.5]],[[.36,.74],[.15,.48],[-.15,.48],[-.36,.74]],[[.5,.7],[.18,.55],[0,.78],[-.18,.55],[-.5,.7]],[[.38,.45],[-.15,.7],[-.35,.9]],[[.42,.5],[.3,.65],[0,.43],[-.3,.65],[-.42,.5]],[[.52,.6],[.32,.42],[0,.62],[-.32,.42],[-.52,.6]]];
  panel(p,a.cloth,[[-.31,1.59],[.31,1.59],[.37,1.25],...outlines[i],[ -.37,1.25]],.025,-.38);motif(p,a,i,0,1.18,-.42,1.4);parts.torso=p;
 }
 return parts;
}
const bladeOutlines=[
 [[-.055,0],[.055,0],[.05,-.55],[0,-.72],[-.05,-.55]],
 [[-.045,0],[.045,0],[.13,-.35],[.075,-.62],[0,-.78],[-.075,-.62],[-.13,-.35]],
 [[-.06,0],[.08,0],[.17,-.45],[.08,-.73],[-.02,-.56],[-.035,-.25]],
 [[-.04,0],[.09,0],[.2,-.3],[.18,-.58],[.05,-.8],[.08,-.45]],
 [[-.09,0],[.09,0],[.13,-.5],[.055,-.76],[0,-.56],[-.055,-.76],[-.13,-.5]],
 [[-.07,0],[.07,0],[.11,-.25],[.05,-.35],[.1,-.48],[.035,-.61],[0,-.8],[-.035,-.61],[-.1,-.48],[-.05,-.35],[-.11,-.25]],
 [[-.06,0],[.06,0],[.14,-.2],[.16,-.53],[0,-.82],[-.16,-.53],[-.14,-.2]],
 [[-.04,0],[.04,0],[.06,-.36],[.13,-.5],[.13,-.76],[.04,-.66],[0,-.5],[-.04,-.66],[-.13,-.76],[-.13,-.5],[-.06,-.36]],
 [[-.065,0],[.065,0],[.145,-.32],[.08,-.62],[0,-.85],[-.08,-.62],[-.145,-.32]],
 [[-.09,0],[.09,0],[.12,-.2],[.075,-.5],[.15,-.66],[.07,-.82],[0,-.7],[-.07,-.82],[-.15,-.66],[-.075,-.5],[-.12,-.2]]
];
function staffHead(p,a,i,y){
 if(i===0){for(const side of[-1,1])beam(p,a.main,[0,y+.2,0],[side*.15,y-.18,0],.035);gem(p,a.glow,0,y-.08,0,.1);}
 if(i===1){const n=tube(p,a.trim,0,y,0,.21,.06,true);n.rotation.x=Math.PI/2;gem(p,a.glow,0,y,.05,.08);}
 if(i===2){gem(p,a.glow,0,y,0,.2);for(const side of[-1,1])cone(p,a.trim,side*.14,y+.03,0,.07,.24,true).rotation.z=side*.5;}
 if(i===3){const n=mesh(p,new THREE.TorusGeometry(.2,.025,5,12,Math.PI*1.5),a.trim,0,y,0,true);n.rotation.z=.7;gem(p,a.glow,.09,y-.02,0,.07);}
 if(i===4){box(p,a.trim,0,y+.12,0,.28,.05,.19,true);box(p,a.trim,0,y-.12,0,.28,.05,.19,true);for(const side of[-1,1])box(p,a.main,side*.12,y,0,.035,.27,.12);gem(p,a.glow,0,y,0,.1);}
 if(i===5){for(let j=-1;j<=1;j++)beam(p,a.trim,[j*.1,y+.15,0],[j*.2,y-.17,0],.035,true);gem(p,a.glow,0,y-.18,0,.08);}
 if(i===6){for(const side of[-1,1])panel(p,a.trim,[[0,y+.04],[side*.29,y-.18],[side*.23,y+.15]],.04,-.02,true);gem(p,a.glow,0,y,0,.1);}
 if(i===7){for(const angle of[0,Math.PI/2]){const n=mesh(p,new THREE.TorusGeometry(.21,.02,5,16),a.trim,0,y,0,true);n.rotation.y=angle;}gem(p,a.glow,0,y,0,.09);}
 if(i===8){for(const side of[-1,1]){beam(p,a.main,[0,y+.2,0],[side*.22,y-.08,0],.04);beam(p,a.main,[side*.15,y,0],[side*.27,y-.24,0],.025);}gem(p,a.glow,0,y-.08,0,.1);}
 if(i===9){for(let j=0;j<8;j++){const angle=j/8*Math.PI*2;beam(p,a.trim,[Math.cos(angle)*.13,y+Math.sin(angle)*.13,0],[Math.cos(angle)*.27,y+Math.sin(angle)*.27,0],.025,true);}gem(p,a.glow,0,y,0,.16);}
}
const bowCurves=[
 [[0,0],[.1,.25],[.16,.55]],[[0,0],[.08,.35],[.2,.7]],[[0,0],[.13,.3],[.02,.55],[.15,.65]],[[0,0],[-.08,.23],[.16,.5],[.24,.66]],[[0,0],[.12,.23],[.22,.42],[.08,.58]],[[0,0],[.14,.2],[.05,.44],[.2,.72]],[[0,0],[.2,.25],[.25,.5],[.08,.63]],[[0,0],[.07,.22],[.2,.32],[.16,.58]],[[0,0],[.1,.25],[.27,.44],[.2,.68]],[[0,0],[.16,.2],[.08,.4],[.3,.6],[.2,.78]]
];
export function progressionWeaponParts(a){
 const i=a.shapeTier-1;if(!profiles[i])throw Error('Unknown weapon shape tier');const p=part(),model=a.model,offhand=['shield','focus'].includes(model);
 if(model==='shield'){
  const outlines=[Array.from({length:12},(_,j)=>[Math.sin(j/12*Math.PI*2)*.32,Math.cos(j/12*Math.PI*2)*.35]),[[-.3,.27],[.3,.27],[0,-.45]],[[-.25,.3],[.25,.3],[.33,.03],[0,-.56],[-.33,.03]],[[-.3,.27],[.3,.27],[.26,-.15],[0,-.4],[-.26,-.15]],[[-.27,.43],[.27,.43],[.27,-.43],[-.27,-.43]],[[-.18,.34],[.18,.34],[.35,0],[.18,-.34],[-.18,-.34],[-.35,0]],[[0,.43],[.28,.2],[.36,-.08],[0,-.46],[-.36,-.08],[-.28,.2]],Array.from({length:16},(_,j)=>[Math.sin(j/16*Math.PI*2)*(j%2?.27:.35),Math.cos(j/16*Math.PI*2)*(j%2?.29:.39)]),[[0,.45],[.34,.1],[.23,-.34],[0,-.48],[-.23,-.34],[-.34,.1]],[[-.34,.2],[-.16,.4],[0,.28],[.16,.4],[.34,.2],[.24,-.2],[0,-.46],[-.24,-.2]]];
  const face=part();panel(face,a.main,outlines[i],.07,0,true);const inset=outlines[i].map(([x,y])=>[x*.82,y*.82]);panel(face,a.trim,inset,.025,-.027,true);motif(face,{...a,armorType:'plate'},i,0,0,-.055,1.2);face.rotation.y=-Math.PI/2;face.position.set(-.16,-.08,.04);p.add(face);return {leftHand:p};
 }
 if(model==='focus'){staffHead(p,a,i,-.2);p.position.set(-.1,-.1,.08);return {leftHand:p};}
 if(model==='bow'){
  for(const side of[-1,1]){const points=bowCurves[i];for(let j=1;j<points.length;j++)beam(p,j%2?a.main:a.trim,[0,side*points[j-1][1],points[j-1][0]],[0,side*points[j][1],points[j][0]],.025+(i%3)*.006);if([4,6,9].includes(i))for(let j=1;j<points.length;j++)beam(p,a.main,[.07,side*points[j-1][1],points[j-1][0]],[.07,side*points[j][1],points[j][0]],.018);}
  const end=bowCurves[i].at(-1);beam(p,a.detail,[0,-end[1],end[0]],[0,end[1],end[0]],.006);tube(p,a.detail,0,0,0,.045,.22);p.position.set(0,-.34,0);return {rightHand:p};
 }
 const long=['staff','spear'].includes(model),wand=model==='wand',length=long?1.65:wand?.58:.8;
 tube(p,a.detail,0,long?-.35:wand?-.08:-.18,0,.032,length);tube(p,a.trim,0,-.1,0,.048,.05,true);gem(p,a.trim,0,long?.5:.24,0,.055);
 if(['sword','dagger','greatsword'].includes(model)){
  const factor=model==='dagger'?.55:model==='greatsword'?1.5:1;panel(p,a.main,bladeOutlines[i].map(([x,y])=>[x*factor,y*factor-.16]),model==='dagger'?.035:.05,-.025,true);
  const width=.27+(i%4)*.055,guard=box(p,a.trim,0,-.13,0,width,.055,.085,true);guard.rotation.z=[0,.12,-.15,.28,0,-.2,.35,0,.1,0][i];if(i===4||i===7||i===9)for(const side of[-1,1])beam(p,a.trim,[side*width*.4,-.12,0],[side*width*.65,-.28,0],.028,true);
 }else if(model==='axe'){
  const outlines=[[[0,.12],[.28,.16],[.33,-.15],[0,-.1]],[[0,.1],[.28,.22],[.4,-.06],[.23,-.27],[0,-.08]],[[0,.12],[.34,.14],[.35,-.25],[.12,-.15],[0,-.05]],[[0,.1],[.32,.24],[.43,.06],[.3,-.25],[.23,-.08],[0,-.1]],[[0,.12],[.24,.18],[.3,-.12],[0,-.08]],[[0,.1],[.32,.1],[.37,-.09],[.2,-.28],[0,-.13]],[[0,.08],[.4,.2],[.3,-.2],[0,-.1]],[[0,.1],[.3,.2],[.38,.02],[.18,-.02],[.28,-.25],[0,-.12]],[[0,.12],[.28,.25],[.43,-.02],[.23,-.27],[0,-.1]],[[0,.14],[.18,.24],[.37,.1],[.26,-.08],[.36,-.2],[.09,-.15],[0,-.05]]];panel(p,a.main,outlines[i].map(([x,y])=>[x,y-.61]),.07,-.035,true);if([4,6,9].includes(i))panel(p,a.main,outlines[i].map(([x,y])=>[-x,y-.61]),.07,-.035,true);
 }else if(model==='hammer'){
  if([0,2,5,8].includes(i)){const n=tube(p,a.main,0,-.62,0,.14+(i%3)*.02,.48,true);n.rotation.z=Math.PI/2;if(i===8)gem(p,a.glow,0,-.62,.12,.18);if(i===2||i===8)for(const side of[-1,1])gem(p,a.trim,side*.28,-.62,0,.13);}
  else if(i===4||i===7){for(const side of[-1,1])box(p,a.main,side*.17,-.62+(i===7?side*.08:0),0,.24,.3,.3,true);beam(p,a.trim,[-.17,-.62,0],[.17,-.62,0],.065,true);}
  else{box(p,a.main,0,-.62,0,.4+i*.012,.23+(i%3)*.04,.26,true);if(i===3||i===9)for(const side of[-1,1])cone(p,a.trim,side*.27,-.62,0,.12,.2,true).rotation.z=side*Math.PI/2;}
 }else if(model==='spear'){
  panel(p,a.main,bladeOutlines[i].map(([x,y])=>[x*.8,y*.65-1.02]),.04,-.02,true);if([3,6,9].includes(i))for(const side of[-1,1])panel(p,a.trim,[[side*.03,-1.02],[side*.19,-1.2],[side*.15,-.9]],.035,-.0175,true);
 }else if(model==='staff'||wand)staffHead(p,a,i,wand?-.42:-1.12);
 else throw Error(`Unknown progression weapon: ${model}`);
 p.rotation.set(-Math.PI/2+.2,Math.PI/2,0);p.position.set(0,-.34,0);return {[offhand?'leftHand':'rightHand']:p};
}
