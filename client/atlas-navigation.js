import {atlasMap,atlasHit} from '/shared/atlas.js';

// Keep drawing and hit testing in the same paper coordinates at every zoom level.
export function atlasPoint(canvas,event){
 const r=canvas.getBoundingClientRect(),v=canvas.atlasView||{x:0,y:0,scale:1};
 return {x:v.x+(event.clientX-r.left)/r.width*1000/v.scale,y:v.y+(event.clientY-r.top)/r.height*720/v.scale};
}
export function bindAtlasZoom(canvas,{show,redraw,hideTooltip}){
 let lastWheel=0,blocked=false,drag=null;
 const clamp=()=>{const v=canvas.atlasView;v.x=Math.max(0,Math.min(1000-1000/v.scale,v.x));v.y=Math.max(0,Math.min(720-720/v.scale,v.y));};
 canvas.addEventListener('wheel',e=>{
  e.preventDefault();e.stopPropagation();if(!e.deltaY)return;
  const now=performance.now();if(now-lastWheel>220)blocked=false;lastWheel=now;if(blocked)return;
  hideTooltip();const p=atlasPoint(canvas,e),v=canvas.atlasView,map=atlasMap(canvas.dataset.mapId),child=atlasHit(map.id,p.x,p.y);
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?720:1),scale=Math.max(1,Math.min(4,v.scale*Math.exp(-Math.max(-240,Math.min(240,delta))*.004)));
  if(delta<0&&scale>=1.8&&child){blocked=true;show(child.id);return;}
  if(delta>0&&v.scale<=1.05&&map.parent){blocked=true;show(map.parent);return;}
  v.x=p.x-(p.x-v.x)*v.scale/scale;v.y=p.y-(p.y-v.y)*v.scale/scale;v.scale=scale;clamp();redraw();
 },{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.atlasDragged=false;drag={x:e.clientX,y:e.clientY,view:{...canvas.atlasView}};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<4&&!canvas.atlasDragged)return;canvas.atlasDragged=true;hideTooltip();const r=canvas.getBoundingClientRect(),v=canvas.atlasView;v.x=drag.view.x-dx/r.width*1000/v.scale;v.y=drag.view.y-dy/r.height*720/v.scale;clamp();redraw();});
 const end=e=>{drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
}
