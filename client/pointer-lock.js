// Pointer capture routes events but does not confine the OS cursor. Pointer lock
// does, and its mousemove deltas remain usable past window/screen boundaries.
export class CameraPointerLock{
 constructor(element,{onMove,onChange,onLost,onError}={}){
  this.element=element;this.document=element.ownerDocument;Object.assign(this,{onMove,onChange,onLost,onError});this.pending=false;this.wanted=false;this.failed=false;this.generation=0;this.point={x:0,y:0};
  this.change=()=>{
   this.pending=false;
   if(this.locked){if(!this.wanted)this.document.exitPointerLock();}
   else if(this.wanted){this.wanted=false;this.generation++;this.onLost?.();}
   this.onChange?.();
  };
  this.error=()=>this.fail(this.generation);
  this.move=e=>{if(!this.locked||!this.wanted||!Number.isFinite(e.movementX)||!Number.isFinite(e.movementY))return;this.point.x+=e.movementX;this.point.y+=e.movementY;this.onMove?.({...this.point});};
  this.document.addEventListener('pointerlockchange',this.change);this.document.addEventListener('pointerlockerror',this.error);this.document.addEventListener('mousemove',this.move);
 }
 get locked(){return this.document.pointerLockElement===this.element;}
 request(x,y){
  if(this.locked||this.pending||this.failed)return;this.wanted=true;this.pending=true;this.point={x,y};const generation=++this.generation;
  try{if(typeof this.element.requestPointerLock!=='function')throw Error('Pointer lock unavailable');const request=this.element.requestPointerLock();request?.catch?.(()=>this.fail(generation));}
  catch{this.fail(generation);}
 }
 fail(generation){if(generation!==this.generation||!this.wanted||this.locked)return;this.pending=false;this.wanted=false;this.failed=true;this.onError?.();this.onChange?.();}
 release(){this.wanted=false;this.pending=false;this.failed=false;this.generation++;if(this.locked)this.document.exitPointerLock();this.onChange?.();}
 coordinates(e){return this.locked?{...this.point}:{x:e.clientX,y:e.clientY};}
 dispose(){this.release();this.document.removeEventListener('pointerlockchange',this.change);this.document.removeEventListener('pointerlockerror',this.error);this.document.removeEventListener('mousemove',this.move);}
}
