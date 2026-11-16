// Keep map names readable without turning the chart into prose or a text cloud.
export function arrangeAtlasLabels(labels,measure){
 const occupied=[{x:35,y:18,w:930,h:80},{x:820,y:535,w:155,h:145}],placed=[];
 const overlaps=(a,b)=>a.x<b.x+b.w+7&&a.x+a.w+7>b.x&&a.y<b.y+b.h+5&&a.y+a.h+5>b.y;
 for(const original of labels){
  let size=original.size||18,w=measure(original.text,size,original.italic);while(w>235&&size>12){size--;w=measure(original.text,size,original.italic);}const angle=original.angle||0,cos=Math.cos(angle),sin=Math.sin(angle),corners=[[-w/2,-size],[w/2,-size],[w/2,4],[-w/2,4]].map(([x,y])=>[x*cos-y*sin,x*sin+y*cos]),left=Math.min(...corners.map(p=>p[0]))-3,top=Math.min(...corners.map(p=>p[1]))-3,width=Math.max(...corners.map(p=>p[0]))-left+3,height=Math.max(...corners.map(p=>p[1]))-top+3,boxAt=p=>({x:p.x+left,y:p.y+top,w:width,h:height});
  const candidates=[];for(const dy of [0,24,-24,48,-48,76,-76,105,-105])for(const dx of [0,45,-45,90,-90])candidates.push({x:original.x+dx,y:original.y+dy});
  // A sparse chart should always have room; the final grid handles close cities.
  for(let y=135;y<620;y+=35)for(let x=160;x<900;x+=245)candidates.push({x,y});
  const at=candidates.find(p=>{const box=boxAt(p);return box.x>=35&&box.x+box.w<=965&&box.y>=100&&box.y+box.h<=630&&!occupied.some(b=>overlaps(box,b));});
  if(!at)continue;const box=boxAt(at);occupied.push(box);placed.push({...original,...at,size,box,anchor:{x:original.x,y:original.y}});
 }
 return placed;
}
