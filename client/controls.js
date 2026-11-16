export const TURN_SPEED=2.4;
const distance=(a,x,y)=>Math.hypot(x-a.x,y-a.y);

// Intent stays separate from camera orbit and from the reconciled pose. Facing
// travels with normal predicted movement, including stationary keyboard turns.
export class AdventureControls{
 constructor(){this.reset();}
 reset(){this.autorun=false;this.heading=null;this.buttons=new Map();this.lastMouse=null;}
 stop(){this.autorun=false;this.clearMouse();}
 clearMouse(){this.buttons.clear();this.lastMouse=null;}
 toggleAutorun(){this.autorun=!this.autorun;}
 manualForward(){this.autorun=false;}
 get bothButtons(){return this.buttons.has(0)&&this.buttons.has(2);}
 get hideCursor(){return this.buttons.has(2)||[...this.buttons.values()].some(b=>b.dragged);}
 mouseDown(button,x,y){
  if(![0,2].includes(button)||this.buttons.has(button))return;
  if(!this.buttons.size)this.lastMouse={x,y};this.buttons.set(button,{x,y,dragged:false,used:false});
  if(this.bothButtons){this.autorun=false;for(const b of this.buttons.values())b.used=true;}
 }
 mouseMove(x,y){
  if(!this.buttons.size||!this.lastMouse)return null;
  const delta={x:x-this.lastMouse.x,y:y-this.lastMouse.y};this.lastMouse={x,y};
  for(const b of this.buttons.values())if(distance(b,x,y)>5){b.dragged=true;b.used=true;}
  return [...this.buttons.values()].some(b=>b.dragged)?delta:null;
 }
 mouseUp(button,x,y){
  const b=this.buttons.get(button);if(!b)return null;
  this.buttons.delete(button);if(!this.buttons.size)this.lastMouse=null;
  return {button,clicked:!b.used&&!b.dragged&&distance(b,x,y)<=5};
 }
 update(dt,cameraYaw,held,enabled=true){
  if(this.heading===null)this.heading=cameraYaw+Math.PI;
  if(!enabled){this.autorun=false;return {x:0,z:0,facing:this.heading,cameraYaw};}
  if(this.buttons.has(2))this.heading=cameraYaw+Math.PI;
  const turn=(Number(held('turnLeft'))-Number(held('turnRight')))*TURN_SPEED*Math.min(.25,Math.max(0,dt));
  this.heading+=turn;
  if(!this.buttons.has(0)||this.buttons.has(2))cameraYaw+=turn;
  const manualForward=held('forward'),backward=held('backward');if(manualForward||backward)this.autorun=false;
  const forward=Number(manualForward||this.autorun||this.bothButtons)-Number(backward),right=Number(held('right'))-Number(held('left')),sin=Math.sin(this.heading),cos=Math.cos(this.heading);
  return {x:forward*sin-right*cos,z:forward*cos+right*sin,facing:this.heading,cameraYaw};
 }
}
