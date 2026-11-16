import {sampleFlight} from '../shared/flight-motion.js';

// Presentation only: arrival, input locking, and route ownership remain on the server.
export class FlightPresentation{
 constructor(heightAt){this.heightAt=heightAt;this.reset();}
 reset(){this.trip=null;this.epoch=null;this.elapsed=0;this.frameAt=null;}
 reconcile(self,time,now){
  const trip=self.transit;
  if(!trip?.points?.length||!trip.duration){this.reset();return;}
  if(!this.trip||self.motionEpoch!==this.epoch||trip.from!==this.trip.from||trip.to!==this.trip.to){
   this.elapsed=trip.elapsed;this.frameAt=now;
  }
  this.trip=trip;this.epoch=self.motionEpoch;this.snapshotTime=time;
 }
 visual(self,now,serverTime){
  if(!self?.transit||!this.trip)return null;
  const dt=Math.max(0,(now-this.frameAt)/1000);this.frameAt=now;
  // Bounded extrapolation handles packet jitter without flying indefinitely on a lost connection.
  const age=Math.max(0,Math.min(.5,serverTime-this.snapshotTime));
  const target=Math.min(this.trip.duration,this.trip.elapsed+age);
  const limit=Math.min(this.trip.duration,this.trip.elapsed+.5);
  const error=target-this.elapsed;
  // Slew small timing corrections instead of snapping at each snapshot or clock update.
  // A resumed/background tab catches up once, rather than spending minutes behind the server.
  if(dt>1||Math.abs(error)>1)this.elapsed=target;
  else this.elapsed=Math.min(limit,this.elapsed+dt*Math.max(.9,Math.min(1.1,1+error*.5)));
  return {...self,...sampleFlight(this.trip,this.elapsed,this.heightAt)};
 }
}
