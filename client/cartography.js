import {arrangeAtlasLabels} from './atlas-labels.js';
import {ATLAS_SIZE,STARTING_MAP,atlasMap,atlasChildren,projectAtlasLocation} from '../shared/atlas.js';
import {questOverlays,trackingMarkers} from './minimap.js';
import {atlasQuestIndicators} from './atlas-quests.js';

const TAU=Math.PI*2,cache=new Map();
const ink='#655039',faint='#8c7654';
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function line(c,points,{color=ink,width=1.5,dash=[]}={}){c.beginPath();c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.setLineDash([]);}
function outline(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function curve(c,points){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length-1;i++){const p=points[i],n=points[i+1];c.quadraticCurveTo(...p,(p[0]+n[0])/2,(p[1]+n[1])/2);}c.lineTo(...points.at(-1));}
function wash(c,x,y,rx,ry,color,rng){c.save();c.fillStyle=color;for(let pass=0;pass<4;pass++){c.globalAlpha=.085;c.beginPath();for(let i=0;i<40;i++){const a=i/40*TAU,r=.89+rng()*.17,px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();}c.restore();}
function tree(c,x,y,s,rng){c.save();c.translate(x,y);c.scale(s,s);const lean=(rng()-.5)*2;line(c,[[0,4],[lean,-18]],{width:1.2,color:'#5e6748'});c.fillStyle='#7d8b61';c.globalAlpha=.72;c.beginPath();c.moveTo(lean,-21);c.bezierCurveTo(-4,-17,-13,-9,-8,-5);c.bezierCurveTo(-17,1,-10,5,-2,3);c.bezierCurveTo(5,7,14,1,9,-4);c.bezierCurveTo(14,-8,5,-18,lean,-21);c.fill();c.strokeStyle='#626d4a';c.lineWidth=.9;c.stroke();c.globalAlpha=.4;line(c,[[-7,8],[6,8]],{width:.8});c.restore();}
function mountain(c,x,y,s){c.save();c.translate(x,y);c.fillStyle='#a6977c55';outline(c,[[-s,s*.36],[0,-s],[s,s*.36]]);c.fill();line(c,[[-s,s*.36],[0,-s],[s,s*.36]],{width:1.5});line(c,[[0,-s],[s*.1,-s*.42],[s*.37,-s*.06],[s*.3,s*.12]],{color:faint,width:1});for(let i=0;i<5;i++)line(c,[[s*.2+i*s*.12,-s*.35+i*s*.14],[s*.1+i*s*.13,s*.25]],{color:'#88785877',width:.75});c.restore();}
function cottage(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='#caaf7f';c.fillRect(-9,-2,18,14);c.strokeStyle=ink;c.lineWidth=1.3;c.strokeRect(-9,-2,18,14);c.fillStyle='#8b6750';outline(c,[[-13,-2],[0,-13],[13,-2]]);c.fill();c.stroke();c.fillStyle=ink;c.fillRect(-2,4,4,8);line(c,[[6,-9],[6,-16],[9,-16],[9,-6]],{width:1});c.restore();}
function settlement(c,p){const{x,y}=p;c.save();c.translate(x,y);if(p.type==='capital'){c.fillStyle='#b0aa8d';c.strokeStyle=ink;for(const x of[-18,0,18]){c.fillRect(x-6,-18,12,37);c.strokeRect(x-6,-18,12,37);for(const dx of[-5,0,5])c.fillRect(x+dx-1,-23,3,7);}line(c,[[-24,20],[24,20]],{width:2});}else if(p.type==='village'){cottage(c,-19,10,.9);cottage(c,17,11,.85);cottage(c,0,-13,.85);line(c,[[-34,29],[0,33],[37,27]],{color:'#89725499',width:1});}else if(p.type==='ruin'){c.fillStyle='#b4a48c';for(const dx of[-25,0,25]){c.fillRect(dx-5,-15,10,30);c.strokeStyle=ink;c.strokeRect(dx-5,-15,10,30);line(c,[[dx-8,-19],[dx+8,-19]],{width:3});}line(c,[[-35,22],[35,22]],{width:2});line(c,[[-29,-23],[-4,-33],[29,-23]],{width:2});}else if(p.type==='hollow'){c.fillStyle='#6e7256';c.beginPath();c.ellipse(0,4,14,9,0,0,TAU);c.fill();line(c,[[-16,12],[-9,-8],[0,-17],[9,-8],[16,12]],{width:2});}else{c.strokeStyle='#a16c3d';c.lineWidth=1.5;c.beginPath();c.arc(0,0,8,0,TAU);c.stroke();for(let i=0;i<8;i++){const a=i*TAU/8;line(c,[[Math.cos(a)*11,Math.sin(a)*11],[Math.cos(a)*15,Math.sin(a)*15]],{color:'#a16c3d'});}}c.restore();}
function label(c,l){c.save();c.translate(l.x,l.y);c.rotate(l.angle||0);c.font=`${l.italic?'italic ':''}${l.size||20}px Georgia`;c.textAlign='center';c.lineWidth=4;c.strokeStyle='#dfc99be0';c.strokeText(l.text,0,0,l.maxWidth||900);c.fillStyle=ink;c.fillText(l.text,0,0,l.maxWidth||900);c.restore();}
function compass(c,x,y){c.save();c.translate(x,y);c.strokeStyle='#8a7250';c.lineWidth=1;c.beginPath();c.arc(0,0,31,0,TAU);c.stroke();for(let i=0;i<8;i++){c.save();c.rotate(i*TAU/8);outline(c,[[0,-43],[-6,0],[0,8],[6,0]]);c.fillStyle=i%2?'#ad9470':'#6a583f';c.fill();c.stroke();c.restore();}c.fillStyle=ink;c.font='17px Georgia';c.textAlign='center';c.fillText('N',0,-51);c.font='11px Georgia';c.fillText('S',0,62);c.fillText('W',-55,4);c.fillText('E',55,4);c.restore();}
function geography(c,f){
 const {x,y}=f,s=f.size||30;c.save();c.translate(x,y);c.strokeStyle='#786b59';c.fillStyle='#a3a79470';c.lineWidth=1.2;
 const ellipse=(rx,ry)=>{c.beginPath();c.ellipse(0,0,rx,ry,0,0,TAU);c.stroke();};
 if(['caldera','craters','basin'].includes(f.kind)){ellipse(s,s*.48);ellipse(s*.7,s*.3);ellipse(s*.27,s*.12);for(let i=0;i<8;i++){const a=i*TAU/8;line(c,[[Math.cos(a)*s*.75,Math.sin(a)*s*.35],[Math.cos(a)*s,Math.sin(a)*s*.5]],{color:'#90795e',width:.8});}}
 else if(f.kind==='fungal'){for(let i=0;i<3;i++){const px=(i-1)*s*.5,py=i%2*s*.3;c.fillStyle='#9a89a46b';c.beginPath();c.ellipse(px,py,s*.35,s*.15,0,Math.PI,0);c.fill();c.stroke();line(c,[[px,py],[px,py+s*.5]],{width:2});}}
 else if(['crystals','glacier','needles'].includes(f.kind)){for(let i=0;i<4;i++){const px=(i-1.5)*s*.35,h=s*(.6+i%2*.35);outline(c,[[px-s*.13,0],[px-s*.1,-h*.7],[px,-h],[px+s*.14,-h*.65],[px+s*.13,0]]);c.fillStyle=f.kind==='glacier'?'#92b1b673':'#a3a5b363';c.fill();c.stroke();}}
 else if(f.kind==='columns'){for(let i=0;i<6;i++){const px=(i-2.5)*s*.25,h=s*(.4+i%3*.2);c.fillRect(px,-h,s*.19,h);c.strokeRect(px,-h,s*.19,h);}}
 else if(['dunes','grassland','terraces'].includes(f.kind)){for(let i=0;i<4;i++){c.beginPath();c.moveTo(-s,i*7);c.bezierCurveTo(-s*.3,-s*.4+i*7,s*.3,s*.4+i*7,s,i*7);c.stroke();}}
 c.restore();
}
function divide(c,edge){
 const color={wall:'#72634f',ice:'#668f9a',roots:'#586b48',ridge:'#81715f',channel:'#568b9c',crevasse:'#414a56'}[edge.kind]||ink;
 line(c,edge.points,{color:color+'88',width:edge.kind==='channel'?12:edge.kind==='wall'?4:7});
 let distance=0;
 for(let i=1;i<edge.points.length;i++){
  const a=edge.points[i-1],b=edge.points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
  for(let d=distance;d<length;d+=16){const x=a[0]+dx*d/length,y=a[1]+dy*d/length;if(x<25||x>975||y<100||y>640)continue;
   if(edge.kind==='wall')line(c,[[x-dy/length*4,y+dx/length*4],[x+dy/length*4,y-dx/length*4]],{color,width:2});
   else if(edge.kind==='channel'||edge.kind==='crevasse')line(c,[[x-dy/length*3,y+dx/length*3],[x+dx/length*5,y+dy/length*5]],{color,width:1});
   else if(edge.kind==='roots')tree(c,x,y,.4,()=>.5);
   else mountain(c,x,y,edge.kind==='ice'?5:6);
  }
  distance=(distance-length)%16;if(distance<0)distance+=16;
 }
}
function serviceIcon(c,p){c.save();c.translate(p.x,p.y);c.fillStyle=p.type==='capital'?'#eee0b1':'#f8efd6';c.strokeStyle=p.type==='flight'?'#347f8a':p.type==='inn'?'#965c32':'#4e6660';c.lineWidth=2;c.beginPath();c.arc(0,0,p.type==='capital'?13:9,0,TAU);c.fill();c.stroke();
 if(p.type==='inn'){c.strokeRect(-5,-1,10,5);line(c,[[-5,-4],[-5,6],[5,6],[5,0]],{color:'#965c32',width:2});c.fillStyle='#965c32';c.fillRect(-4,-3,3,3);}
 else if(p.type==='flight'){line(c,[[-7,-3],[-3,0],[0,5],[3,0],[7,-3],[3,-2],[0,0],[-3,-2],[-7,-3]],{color:'#347f8a',width:2});}
 else {c.fillStyle='#4e6660';for(const x of [-7,0,7]){c.fillRect(x-2,-5,4,12);c.fillRect(x-3,-8,6,4);}c.fillRect(-7,2,14,5);}
 c.restore();}
export function chartBackground(id){
  if(cache.has(id))return cache.get(id);
  const map=atlasMap(id),canvas=document.createElement('canvas');canvas.width=ATLAS_SIZE.width;canvas.height=ATLAS_SIZE.height;
  const c=canvas.getContext('2d'),rng=random([...map.id].reduce((s,v)=>s+v.charCodeAt(0),871));
  c.fillStyle='#dfc99b';c.fillRect(0,0,1000,720);
  const age=c.createRadialGradient(470,320,100,470,320,610);age.addColorStop(0,'#f5e7bf33');age.addColorStop(.7,'#9876400c');age.addColorStop(1,'#77532770');c.fillStyle=age;c.fillRect(0,0,1000,720);
  for(let i=0;i<5300;i++){c.fillStyle=i%3?'#684c2520':'#fff5d338';c.fillRect(rng()*1000,rng()*720,rng()*2+.4,rng()*.9+.3);}
  c.strokeStyle='#806a4938';c.lineWidth=1;for(const x of[333,667]){c.beginPath();c.moveTo(x,20);c.lineTo(x-3,700);c.stroke();}line(c,[[20,361],[980,358]],{color:'#806a4920',width:2});
  c.save();outline(c,map.survey);c.clip();
  for(const land of map.landAreas||[]){outline(c,land.points);c.fillStyle=land.color;c.globalAlpha=.5;c.fill();c.globalAlpha=1;}
  for(const edge of map.borders||[])line(c,edge,{color:'#675b49a0',width:map.kind==='World'?1.7:.8});
  for(const w of map.washes||[])wash(c,w.x,w.y,w.rx,w.ry,w.color,rng);
  for(const points of map.rivers||[]){curve(c,points);c.strokeStyle='#6e8d8980';c.lineWidth=12;c.stroke();c.strokeStyle='#527878';c.lineWidth=1.2;c.stroke();curve(c,points.map(([x,y])=>[x+4,y]));c.strokeStyle='#edf0cd88';c.lineWidth=2;c.stroke();}
  for(const f of map.forests||[])for(let i=0;i<f.count;i++){const a=rng()*TAU,r=Math.sqrt(rng());tree(c,f.x+Math.cos(a)*r*f.rx,f.y+Math.sin(a)*r*f.ry,.65+rng()*.35,rng);}
  for(const lake of map.lakes||[]){c.beginPath();c.ellipse(lake.x,lake.y,lake.rx,lake.ry,0,0,TAU);c.fillStyle='#8caaa0';c.fill();c.strokeStyle='#527878';c.lineWidth=1;c.stroke();line(c,[[lake.x-lake.rx*.5,lake.y],[lake.x+lake.rx*.4,lake.y-1]],{color:'#e6ead0',width:1});}
  for(const m of map.mountains||[])for(let i=0;i<m.count;i++)mountain(c,m.x+(i-(m.count-1)/2)*m.size*1.3,m.y+Math.sin(i*1.7)*m.size*.35,m.size*(.7+rng()*.5));
  for(const edge of map.boundaries||[])divide(c,edge);
  for(const points of map.roads||[]){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle='#b68e5670';c.lineWidth=8;c.stroke();c.strokeStyle='#886e48';c.lineWidth=1.8;c.setLineDash([3,5]);c.stroke();c.setLineDash([]);}
  for(const crossing of map.crossings||[]){c.fillStyle='#e7d4ad';c.beginPath();c.arc(crossing.x,crossing.y,5,0,TAU);c.fill();line(c,[[crossing.x-4,crossing.y+4],[crossing.x,crossing.y-3],[crossing.x+4,crossing.y+4]],{color:'#786448',width:1.5});}
  for(const f of map.geography||[])geography(c,f);
  for(const points of map.fieldStrokes||[])line(c,points,{color:'#93834a88',width:1});
  for(const b of map.blocks||[]){c.fillStyle=b.landmark?'#a8885b':'#c2a87c';c.strokeStyle=ink;c.lineWidth=b.landmark?1.5:.7;c.fillRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);c.strokeRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);line(c,[[b.x-b.w/2,b.y],[b.x+b.w/2,b.y]],{color:'#7d674b',width:.7});}
  if(map.walls){line(c,map.walls,{color:'#776a51',width:5});line(c,map.walls,{color:'#d3bc91',width:2});}
  for(const p of map.settlements||[])settlement(c,p);
  // Nearby inn and flight glyphs form a paired badge, rather than obscuring
  // one another at local-map scale. Their geographic anchor stays unchanged.
  for(const p of map.services||[]){const paired=p.type==='flight'&&(map.services||[]).some(q=>q.type==='inn'&&Math.hypot(q.x-p.x,q.y-p.y)<20);serviceIcon(c,{...p,x:p.x+(paired?18:0)});}


  c.restore();
  // The unfinished edge is a survey line fading into untouched paper. It is
  // content availability, not personal exploration or an invented landmass.
  line(c,[...map.survey,map.survey[0]],{color:'#8c79584d',width:1,dash:[2,7]});
  const labels=map.avoidLabelCollisions?arrangeAtlasLabels(map.labels||[],(text,size,italic)=>{c.font=`${italic?'italic ':''}${size}px Georgia`;return c.measureText(text).width;}):map.labels||[];
  canvas.dataset.labelBoxes=JSON.stringify(labels.map(l=>l.box).filter(Boolean));
  for(const l of labels){if(l.anchor&&Math.hypot(l.x-l.anchor.x,l.y-l.anchor.y)>25)line(c,[[l.anchor.x,l.anchor.y-12],[l.x,l.y-12]],{color:'#89775e60',width:.8});label(c,l);}
  for(const u of map.unknown||[])label(c,{...u,size:15,italic:true});
  c.strokeStyle='#846b46';c.lineWidth=1;c.strokeRect(17,17,966,686);c.strokeStyle='#846b4666';c.strokeRect(22,22,956,676);
  for(const[x,y]of[[29,29],[971,29],[29,691],[971,691]]){c.fillStyle=ink;outline(c,[[x,y-4],[x+4,y],[x,y+4],[x-4,y]]);c.fill();}
  label(c,{text:map.name.toUpperCase(),x:500,y:51,size:29});label(c,{text:map.subtitle,x:500,y:75,size:14,italic:true});
  compass(c,889,615);
  if(map.services?.length){for(const [i,type]of ['inn','flight','capital'].entries()){serviceIcon(c,{type,x:95+i*260,y:678});label(c,{text:['Inn / return hearth','Flight stone','Capital city'][i],x:170+i*260,y:683,size:12});}}
  if(map.footer!==false)label(c,{text:map.kind==='Capital city'?'City wards · river road and guest hearths':map.kind==='Zone'?'Surveyed paths · distances approximate':'Only the surveyed frontier is inked',x:297,y:675,size:13,italic:true});
  cache.set(id,canvas);return canvas;
}
function dot(c,x,y,color,r=4){c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();c.strokeStyle='#4c3b2b';c.lineWidth=1.5;c.stroke();}
export function drawAtlas(canvas,{player,players=[],npcs=[],enemies=[],tracking={},cameraHeading=Math.PI}={}){
  const hits=[];canvas.atlasHits=hits;
  const map=atlasMap(canvas.dataset.mapId),c=canvas.getContext('2d');c.save();c.setTransform(canvas.width/1000,0,0,canvas.height/720,0,0);c.clearRect(0,0,1000,720);const view=canvas.atlasView||{x:0,y:0,scale:1};c.scale(view.scale,view.scale);c.translate(-view.x,-view.y);c.drawImage(chartBackground(map.id),0,0);
  canvas.atlasServices=(map.services||[]).map(s=>{const paired=s.type==='flight'&&(map.services||[]).some(v=>v.type==='inn'&&Math.hypot(s.x-v.x,s.y-v.y)<20);return {...s,serviceType:s.type,kind:'service',x:s.x+(paired?18:0),title:s.name,detail:s.type==='inn'?(player?.waypointId===s.id?'Your bound return hearth.':'Inn · Visit the hearth or innkeeper to bind your return.') :s.type==='capital'?'Capital city · Civic wards, inns, flight stone and capital portal.':`${player?.travelUnlocks?.includes(s.id)?'Discovered':'Visit on foot to discover'} · Open Travel beside the stone to fly.`};});
  const project=location=>projectAtlasLocation(map.id,location);
  const children=atlasChildren(map.id),overlays=player&&map.bounds?questOverlays(player,enemies,tracking):[];for(const child of children)if(child.id===canvas.dataset.hoverMap)for(const polygon of child.outlines||[child.outline]){outline(c,polygon);c.fillStyle='#81664018';c.fill();c.strokeStyle='#795c3bb0';c.lineWidth=2;c.setLineDash([6,5]);c.stroke();c.setLineDash([]);}
  if(player){
    if(map.bounds){
      c.save();outline(c,map.survey);c.clip();
      for(const q of overlays){const pos=project(q.ready?q.target:q.area);if(!pos)continue;if(!q.ready){hits.push({kind:'questArea',x:pos.x,y:pos.y,rx:q.area.radius*1000/(map.bounds.maxX-map.bounds.minX),ry:q.area.radius*720/(map.bounds.maxZ-map.bounds.minZ),quests:[q]});c.save();c.translate(pos.x,pos.y);c.scale(1000/(map.bounds.maxX-map.bounds.minX),720/(map.bounds.maxZ-map.bounds.minZ));c.beginPath();c.arc(0,0,q.area.radius,0,TAU);c.fillStyle=q.selected?'#ab713324':'#617e9320';c.fill();c.strokeStyle=q.selected?'#94662bc0':'#567080a0';c.lineWidth=.25;c.setLineDash([.6,.5]);c.stroke();c.restore();}}
      for(const marker of trackingMarkers(player,tracking,npcs)){if((map.services||[]).some(s=>marker.id==='travel:'+s.id||marker.id==='waypoint:'+s.id))continue;const pos=project(marker);if(!pos)continue;c.font='bold 15px Georgia';c.textAlign='center';c.strokeStyle='#f2dfb4';c.lineWidth=4;const glyph=marker.glyph||(marker.kind==='herbs'?'♧':marker.kind==='mining'?'◇':'▪');c.strokeText(glyph,pos.x,pos.y+4);c.fillStyle=ink;c.fillText(glyph,pos.x,pos.y+4);}
      const clusters=[];for(const q of overlays){if(q.target.self)continue;const pos=project(q.target);if(!pos)continue;let group=clusters.find(g=>Math.hypot(g.x-pos.x,g.y-pos.y)<25);if(group)group.quests.push(q);else clusters.push({...pos,quests:[q]});}
      for(const group of clusters){const label=group.quests.map(q=>q.number).join('·'),width=Math.max(13,label.length*5);hits.push({kind:'quest',x:group.x,y:group.y,rx:width,ry:12,quests:group.quests});c.fillStyle='#a47a39';c.strokeStyle='#f5e5bd';c.lineWidth=2;c.beginPath();c.ellipse(group.x,group.y,width,12,0,0,TAU);c.fill();c.stroke();c.font='bold 13px Georgia';c.textAlign='center';c.fillStyle='#fff4cf';c.fillText(label,group.x,group.y+4);}
      for(const p of players){if(p.id===player.id)continue;const pos=projectAtlasLocation(map.id,p);if(pos)dot(c,pos.x,pos.y,'#588374',3);}
      c.restore();
    }
    for(const indicator of atlasQuestIndicators(map.id,player)){
      const label=`${indicator.count} ${indicator.count===1?'quest':'quests'}`,rx=Math.max(34,label.length*4.5);hits.push({...indicator,rx,ry:16});
      c.fillStyle='#84602d';c.strokeStyle='#f5e5bd';c.lineWidth=2;c.beginPath();c.roundRect(indicator.x-rx,indicator.y-14,rx*2,28,8);c.fill();c.stroke();c.font='bold 14px Georgia';c.fillStyle='#fff1cb';c.textAlign='center';c.fillText(label,indicator.x,indicator.y+5);
    }
    const pos=project(player);
    if(pos){c.strokeStyle='#f7e5b9';c.lineWidth=4;c.beginPath();c.arc(pos.x,pos.y,10,0,TAU);c.stroke();dot(c,pos.x,pos.y,'#326478',6);
      // World headings use +Z (south) as zero; this glyph starts north.
      const heading=Number.isFinite(cameraHeading)?cameraHeading:Math.PI;
      c.save();c.translate(pos.x,pos.y);c.rotate(Math.PI-heading);c.fillStyle='#326478';outline(c,[[0,-17],[-5,-8],[5,-8]]);c.fill();c.restore();canvas.dataset.playerX=String(pos.x);canvas.dataset.playerY=String(pos.y);canvas.dataset.playerHeading=String(heading);}else{delete canvas.dataset.playerX;delete canvas.dataset.playerY;delete canvas.dataset.playerHeading;}
  }
  c.restore();canvas.dataset.mapId=map.id;canvas.dataset.level=map.kind.toLowerCase();canvas.dataset.zoneQuestCounts=JSON.stringify(hits.filter(h=>h.kind==='zoneQuests').map(h=>({id:h.zoneId,count:h.count})));const quests=overlays.map(q=>q.id).join('|');if(canvas.dataset.questIds!==quests)canvas.dataset.questIds=quests;
}
