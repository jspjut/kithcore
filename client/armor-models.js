import * as THREE from 'three';
const materials=new Map();
function material(color,metal=false,glow=false){const key=`${color}:${metal}:${glow}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:metal?.45:.94,metalness:metal?.6:0,...glow?{emissive:color,emissiveIntensity:.35}:{}}));return materials.get(key);}
function mesh(p,g,c,x=0,y=0,z=0,metal=false,glow=false){const m=new THREE.Mesh(g,material(c,metal,glow));m.position.set(x,y,z);p.add(m);return m;}
const box=(p,c,x,y,z,w,h,d,metal=false)=>mesh(p,new THREE.BoxGeometry(w,h,d),c,x,y,z,metal);
const ball=(p,c,x,y,z,rx,ry=rx,rz=rx,metal=false,glow=false)=>{const m=mesh(p,new THREE.SphereGeometry(1,12,8),c,x,y,z,metal,glow);m.scale.set(rx,ry,rz);return m;};
const tube=(p,c,x,y,z,r,h,metal=false)=>mesh(p,new THREE.CylinderGeometry(r,r,h,12),c,x,y,z,metal);
const spike=(p,c,x,y,z,r,h,metal=false)=>mesh(p,new THREE.ConeGeometry(r,h,6),c,x,y,z,metal);
const part=()=>new THREE.Group();
function gem(p,a,x,y,z,s=.045){const m=mesh(p,new THREE.OctahedronGeometry(s),a.glow,x,y,z,false,true);m.scale.z=.5;return m;}
function scaleRows(p,a,rows=4){for(let row=0;row<rows;row++)for(let col=0;col<5;col++){const x=(col-2)*.095+(row%2?.025:0),y=1.48-row*.105;ball(p,col%2?a.main:a.trim,x,y,.273,.065,.073,.019,true);}}
export function armorParts(a){
  const p=part(),parts={},cloth=a.armorType==='cloth',leather=a.armorType==='leather',mail=a.armorType==='mail',plate=a.armorType==='plate',boss=a.tier==='boss',metal=mail||plate;
  if(a.slot==='head'){
    if(cloth||leather){mesh(p,new THREE.SphereGeometry(.31,16,10,Math.PI*.75,Math.PI*1.5,0,Math.PI*.8),a.main,0,.025,-.045);mesh(p,new THREE.SphereGeometry(.305,16,8,0,Math.PI*2,0,Math.PI*.44),a.main,0,.065,-.045);for(const side of[-1,1])box(p,a.trim,side*.245,-.05,.12,.035,.26,.045);}
    else{mesh(p,new THREE.SphereGeometry(.29,16,10,0,Math.PI*2,0,Math.PI*.54),a.main,0,.06,-.035,true);tube(p,a.trim,0,.04,-.035,.296,.055,true);for(const side of[-1,1])box(p,a.main,side*.25,-.09,.045,.055,.24,.19,true);if(plate)box(p,a.trim,0,-.02,.264,.045,.22,.045,true);else for(let i=0;i<5;i++)box(p,a.trim,(i-2)*.095,-.18,-.19,.07,.2,.055,true);}
    if(boss){gem(p,a,0,.1,.265,.06);if(cloth){const ring=mesh(p,new THREE.TorusGeometry(.26,.017,6,20),a.trim,0,.39,-.06,true);ring.rotation.x=Math.PI/2;for(const side of[-1,1])spike(p,a.glow,side*.18,.42,-.04,.025,.14);}
      if(leather)for(const side of[-1,1]){const b=spike(p,a.trim,side*.24,.35,-.07,.065,.45);b.rotation.z=side*-.55;spike(p,a.trim,side*.38,.43,-.06,.035,.2).rotation.z=side*-.95;}
      if(mail)for(let i=0;i<5;i++){const fin=spike(p,a.trim,0,.26,-.15+i*.07,.075,.24+Math.sin(i)*.07,true);fin.scale.x=.4;}
      if(plate)for(let i=-2;i<=2;i++){const crest=box(p,a.trim,i*.095,.25+(.15-Math.abs(i)*.04),-.015,.055,.3-Math.abs(i)*.05,.075,true);crest.rotation.z=-i*.12;}}
    parts.head=p;
  }else if(a.slot==='armor'){
    const torso=mesh(p,new THREE.CylinderGeometry(.32,.28,.8,12),a.main,0,1.25,0,metal);torso.scale.z=.91;
    tube(p,a.detail,0,.94,0,.29,.06).scale.z=.93;
    if(cloth){for(const side of[-1,1]){box(p,a.trim,side*.18,1.31,.26,.035,.55,.025).rotation.z=side*.12;const skirt=part();box(skirt,a.main,0,-.28,.18,.29,.62,.07);box(skirt,a.trim,side*.09,-.27,.225,.025,.59,.018);box(skirt,a.main,0,-.28,-.19,.3,.62,.065);parts[side<0?'leftThigh':'rightThigh']=skirt;}box(p,a.trim,0,.93,.282,.17,.065,.035);}
    if(leather){for(const side of[-1,1]){box(p,a.detail,side*.22,1.23,.2,.12,.49,.1);box(p,a.trim,side*.18,1.29,.275,.04,.45,.02);}box(p,a.trim,0,1.31,.283,.045,.6,.025).rotation.z=.6;box(p,a.detail,-.19,1.04,.29,.13,.15,.06);}
    if(mail){scaleRows(p,a);for(const side of[-1,1])box(p,a.cloth,side*.2,1.22,-.22,.05,.6,.065);}
    if(plate){ball(p,a.main,0,1.32,.21,.29,.29,.14,true);for(const side of[-1,1])box(p,a.trim,side*.23,1.33,.28,.045,.43,.04,true).rotation.z=side*.12;for(const y of[1.06,1.14])box(p,a.main,0,y,.25,.43,.075,.07,true);}
    for(const side of[-1,1]){const sleeve=part(),forearm=part();tube(sleeve,a.main,0,-.16,0,.133,.31,metal);tube(forearm,cloth?a.main:a.detail,0,-.145,0,.106,.28,metal);parts[side<0?'leftSleeve':'rightSleeve']=sleeve;parts[side<0?'leftForearm':'rightForearm']=forearm;}
    if(boss){gem(p,a,0,1.4,.34,.08);for(const side of[-1,1]){const collar=box(p,a.trim,side*.19,1.62,-.055,.16,.21,.1,metal);collar.rotation.z=side*-.35;}for(let i=0;i<3;i++){const sigil=box(p,a.trim,0,1.15+i*.09,.31,.055,.055,.02,metal);sigil.rotation.z=Math.PI/4;}}
    parts.torso=p;
  }else if(a.slot==='shoulders'){
    for(const side of[-1,1]){const pad=part();ball(pad,a.main,side*.025,.015,0,cloth?.18:.23,cloth?.075:.14,.24,metal);box(pad,a.trim,side*.03,-.035,.19,.3,.045,.035,metal);
      if(mail)for(let i=0;i<3;i++)ball(pad,a.trim,side*(.08+i*.055),-.06-i*.025,.02,.1,.06,.23,true);
      if(boss){for(let i=0;i<3;i++){if(leather)spike(pad,a.trim,side*(.04+i*.07),.16+i*.02,-.12+i*.1,.045,.25+i*.06).rotation.z=side*-.65;else{const wing=box(pad,a.trim,side*(.09+i*.07),.13+i*.045,-.04,.065,.22,.27,metal);wing.rotation.z=side*-.4;}}gem(pad,a,side*.06,.16,.12,.045);}
      parts[side<0?'leftSleeve':'rightSleeve']=pad;
    }
  }else if(a.slot==='hands'){
    for(const side of[-1,1]){const glove=part();tube(glove,a.main,0,-.23,0,.115,.2,metal);ball(glove,a.main,0,-.35,0,.112,.1,.11,metal);box(glove,a.trim,0,-.3,.096,.17,.045,.028,metal);if(plate)box(glove,a.trim,0,-.19,.1,.17,.17,.055,true);if(boss)gem(glove,a,0,-.25,.125,.035);parts[side<0?'leftHand':'rightHand']=glove;}
  }else if(a.slot==='waist'){
    tube(p,a.main,0,.94,0,.304,.12,metal).scale.z=.92;box(p,a.trim,0,.94,.294,.13,.1,.035,metal);
    for(const side of[-1,1]){if(leather){box(p,a.detail,side*.34,.88,.06,.15,.21,.17);box(p,a.trim,side*.34,.92,.15,.07,.05,.02);}
      else{const flap=box(p,cloth?a.main:a.trim,side*.18,.8,.21,.22,.23,.045,metal);flap.rotation.z=side*-.12;}}
    if(boss)gem(p,a,0,.94,.329,.055);parts.torso=p;
  }else if(a.slot==='legs'){
    for(const side of[-1,1]){const thigh=part(),shin=part();box(thigh,a.main,0,-.21,0,.25,.435,.28,metal);box(shin,a.main,0,-.21,0,.22,.425,.25,metal);box(thigh,a.trim,side*.105,-.22,.135,.028,.36,.02,metal);if(metal){ball(shin,a.trim,0,-.04,.13,.115,.105,.045,true);for(const y of[-.17,-.28])box(shin,a.detail,0,y,.133,.18,.035,.03,true);}if(boss)gem(thigh,a,0,-.14,.158,.045);parts[side<0?'leftThigh':'rightThigh']=thigh;parts[side<0?'leftShin':'rightShin']=shin;}
  }else if(a.slot==='feet'){
    for(const side of[-1,1]){const boot=part();box(boot,a.main,0,-.01,.095,.28,cloth?.13:.18,.42,metal);box(boot,a.detail,0,-.1,.09,.29,.04,.43);tube(boot,a.main,0,.085,0,.13,cloth?.13:.23,metal);tube(boot,a.trim,0,.19,0,.14,.045,metal);if(plate)box(boot,a.trim,0,.01,.25,.24,.07,.09,true);if(boss)gem(boot,a,0,.09,.14,.035);parts[side<0?'leftFoot':'rightFoot']=boot;}
  }else if(a.slot==='back'){
    const cape=new THREE.Shape();cape.moveTo(-.35,1.59);cape.lineTo(.35,1.59);cape.lineTo(.42,.59);cape.lineTo(.23,boss?.49:.57);cape.lineTo(0,.61);cape.lineTo(-.23,boss?.49:.57);cape.lineTo(-.42,.59);cape.closePath();mesh(p,new THREE.ExtrudeGeometry(cape,{depth:.025,bevelEnabled:false,steps:1}),a.cloth,0,0,-.36);
    for(const side of[-1,1])box(p,a.trim,side*.28,1.15,-.382,.035,.76,.02).rotation.z=side*-.06;
    box(p,a.trim,0,1.54,-.39,.5,.055,.025);if(boss){gem(p,a,0,1.25,-.4,.12);for(const side of[-1,1])box(p,a.trim,side*.12,1.14,-.396,.025,.28,.025).rotation.z=side*.6;}parts.torso=p;
  }
  return parts;
}
export function extraWeaponParts(a){
  const p=part();
  if(a.model==='bow'){
    for(const side of[-1,1]){const limb=box(p,a.main,0,side*.31,-.08,.07,.65,.075);limb.rotation.x=side*-.32;const tip=box(p,a.trim,0,side*.64,.03,.045,.14,.05);tip.rotation.x=side*.2;for(let i=0;i<2;i++)spike(p,a.trim,side*.03,side*(.2+i*.23),-.13,.025,.16).rotation.z=side*-.7;}
    tube(p,a.detail,0,0,-.16,.05,.22);box(p,a.detail,0,0,.05,.009,1.3,.009);gem(p,a,0,0,-.215,.07);p.position.set(0,-.34,0);
  }else if(a.model==='focus'){
    ball(p,a.glow,0,-.19,.1,.13,.18,.13,false,true);for(const side of[-1,1]){const cage=box(p,a.trim,side*.18,-.2,.1,.025,.42,.03,true);cage.rotation.z=side*-.2;}tube(p,a.trim,0,-.43,.1,.15,.045,true);spike(p,a.trim,0,.04,.1,.13,.18,true);p.position.set(-.1,-.15,.02);return {leftHand:p};
  }else if(a.model==='greatsword'){
    tube(p,a.detail,0,.015,0,.045,.28);ball(p,a.trim,0,.2,0,.07,.075,.065,true);box(p,a.trim,0,-.15,0,.5,.07,.1,true);
    const blade=new THREE.Shape();blade.moveTo(-.1,-.19);blade.lineTo(.1,-.19);blade.lineTo(.12,-1);blade.lineTo(.055,-1.21);blade.lineTo(0,-1);blade.lineTo(-.055,-1.21);blade.lineTo(-.12,-1);blade.closePath();mesh(p,new THREE.ExtrudeGeometry(blade,{depth:.055,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,steps:1,bevelSegments:1}),a.main,0,0,-.0275,true);gem(p,a,0,-.42,.07,.095);p.rotation.set(-Math.PI/2+.2,Math.PI/2,0);p.position.set(0,-.34,0);
  }else{
    tube(p,a.detail,0,0,0,.035,.19);box(p,a.trim,0,-.12,0,.27,.045,.075,true);const blade=new THREE.Shape();blade.moveTo(-.06,-.14);blade.lineTo(.07,-.14);blade.lineTo(.12,-.38);blade.lineTo(.02,-.56);blade.lineTo(-.035,-.3);blade.closePath();mesh(p,new THREE.ExtrudeGeometry(blade,{depth:.035,bevelEnabled:false}),a.main,0,0,-.0175,true);gem(p,a,0,-.12,.05,.04);p.rotation.set(-Math.PI/2+.2,Math.PI/2,0);p.position.set(0,-.34,0);
  }
  return {rightHand:p};
}
export function decorateReward(parts,a){
  if(!a.identity)return parts;const hand=parts.rightHand||parts.leftHand;
  if(a.model==='sword'||a.model==='greatsword'){for(const side of[-1,1]){const wing=box(hand,a.trim,side*.2,-.09,0,.06,.29,.08,true);wing.rotation.z=side*-.6;}gem(hand,a,0,-.17,.09,.075);if(a.model==='greatsword'){hand.scale.set(1.3,1.55,1.2);for(const side of[-1,1])box(hand,a.detail,side*.095,-.43,.02,.025,.32,.06,true);}}
  if(a.model==='staff'){const orbit=mesh(hand,new THREE.TorusGeometry(.24,.018,6,20),a.trim,0,-1.04,0,true);orbit.rotation.y=.6;const orbit2=mesh(hand,new THREE.TorusGeometry(.21,.014,6,20),a.trim,0,-1.04,0,true);orbit2.rotation.x=1.1;gem(hand,a,0,-1.02,.1,.1);}
  if(a.model==='axe'){for(const side of[-1,1])spike(hand,a.trim,side*.14,-.67,.04,.04,.22,true).rotation.z=side*.7;box(hand,a.trim,.22,-.61,.045,.04,.25,.02,true).rotation.z=.3;}
  if(a.model==='hammer'){for(const side of[-1,1]){const shard=spike(hand,a.glow,side*.21,-.6,0,.13,.37);shard.rotation.z=side*Math.PI/2;}gem(hand,a,0,-.6,.18,.09);}
  if(a.model==='spear')for(const side of[-1,1]){const fin=spike(hand,a.trim,side*.12,-1.1,0,.07,.34,true);fin.rotation.z=side*-.4;}
  if(a.model==='shield'){for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;const thorn=spike(hand,a.trim,-.15,-.08+Math.cos(angle)*.35,.04+Math.sin(angle)*.35,.045,.2);thorn.rotation.set(angle,0,Math.PI/2);}gem(hand,a,-.23,-.08,.04,.12);}
  return parts;
}
