import test from 'node:test';
import assert from 'node:assert/strict';
import {FlightPresentation} from '../client/flight-presentation.js';
import {sampleFlight} from '../shared/flight-motion.js';
const trip={from:'a',to:'b',points:[[0,0],[90,0],[90,810]],length:900,duration:10,elapsed:0};
const self=elapsed=>({motionEpoch:1,transit:{...trip,elapsed}});
test('flight samples arc length, corners, altitude and endpoints',()=>{
 assert.equal(sampleFlight(trip,.5,()=>0).x,45);
 const corner=sampleFlight(trip,2,()=>3);assert.equal(corner.x,90);assert.equal(corner.z,90);assert.equal(corner.y,3+Math.sin(Math.PI*.2)*24);
 assert.equal(sampleFlight(trip,50,()=>0).z,810);
});
test('flight advances every render frame through irregular snapshots and clock corrections',()=>{
 const flight=new FlightPresentation(()=>0);flight.reconcile(self(2),2,0);
 let old=flight.visual(self(2),0,2),stopped=0;
 for(let frame=1;frame<=180;frame++){
  const now=frame*1000/60,t=2+now/1000;
  if(frame%7===0||frame%11===0)flight.reconcile(self(t),t,now);
  const pose=flight.visual(self(t),now,t+(frame>90?.08:0)),distance=Math.hypot(pose.x-old.x,pose.z-old.z);
  if(distance===0)stopped++;
  assert.ok(distance>=1.35-1e-8&&distance<=1.65+1e-8,`unexpected frame distance ${distance}`);old=pose;
 }
 assert.equal(stopped,0);
});
test('lost snapshots stop bounded extrapolation; arrival and epoch reset discard flight',()=>{
 const flight=new FlightPresentation(()=>0);flight.reconcile(self(2),2,0);
 for(let frame=1;frame<=180;frame++)flight.visual(self(2),frame*1000/60,2+frame/60);
 assert.equal(flight.elapsed,2.5);
 flight.reconcile({motionEpoch:2,transit:null},6,4000);assert.equal(flight.visual({transit:null},4000,6),null);
 flight.reconcile({...self(0),motionEpoch:3},7,5000);assert.equal(flight.elapsed,0);
 flight.reset();assert.equal(flight.visual(self(0),6000,8),null);
});
