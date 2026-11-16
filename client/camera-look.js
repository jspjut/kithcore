// Pitch is positive when looking down. Leave a margin before vertical so the
// orbit does not flip its horizontal heading at either pole.
export const MIN_CAMERA_PITCH=-1.2,MAX_CAMERA_PITCH=1.48,CAMERA_GROUND_CLEARANCE=.4;
export const clampCameraPitch=pitch=>Math.max(MIN_CAMERA_PITCH,Math.min(MAX_CAMERA_PITCH,pitch));
export function cameraOrbit(focus,yaw,pitch,distance,heightAt){
 const horizontal=Math.cos(pitch)*distance,x=focus.x+Math.sin(yaw)*horizontal,z=focus.z+Math.cos(yaw)*horizontal,desiredY=focus.y+Math.sin(pitch)*distance,y=Math.max(desiredY,heightAt(x,z)+CAMERA_GROUND_CLEARANCE);
 // Raising an underground camera must not silently undo the look-up input.
 // Raise its aim by the same amount, preserving the requested view direction.
 return {x,y,z,targetY:focus.y+y-desiredY};
}
