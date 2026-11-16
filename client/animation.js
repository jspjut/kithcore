// Presentation only: driven every rendered frame by predicted/interpolated poses.
// A stance foot travels backward by the distance the body travels forward.
const TAU=Math.PI*2,STRIDE=3.4,STANCE=.32,LEG=.43,HIP=.95,SOLE=.12;
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>t*t*(3-2*t);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export class CharacterAnimator{
  constructor(){this.reset();}
  reset(){this.last=null;this.speed=0;this.phase=0;this.age=0;this.blend=0;this.air=0;this.land=0;this.wasAir=false;this.attack=0;this.facing=0;this.lowerYaw=0;this.targetYaw=0;this.backward=false;this.backpedal=0;}
  strike(){this.attack=1;}
  step(pose,dt,heightAt,{dead=false,casting=false,scaleX=1,scaleZ=1}={}){
    dt=clamp(dt,0,.1);this.age+=dt;
    const ground=heightAt(pose.x,pose.z),dx=this.last?pose.x-this.last.x:0,dz=this.last?pose.z-this.last.z:0,travel=Math.hypot(dx,dz);
    const teleport=!this.last||travel>2;
    const airborne=pose.grounded===false||(pose.jumpHeight||0)>.015;
    if(teleport){this.speed=0;this.blend=0;this.phase=0;this.facing=pose.facing||0;this.air=airborne?1:0;this.land=0;this.lowerYaw=0;this.targetYaw=0;this.backward=false;this.backpedal=0;}
    else{
      // Filtering speed keeps fixed-step prediction from alternating idle/run at 144Hz.
      this.speed=clamp(mix(this.speed,dt>0?travel/dt:0,1-Math.exp(-12*dt)),0,12);
      this.facing+=angleDelta(this.facing,pose.facing||0)*(1-Math.exp(-20*dt));
      if(travel>1e-6){
        // Choose a forward-facing stance within 90 degrees of the look heading.
        // Backward diagonals use the opposite stance and reverse the gait, rather
        // than turning the character around and running forward away from aim.
        // Interpolated turns can give a pure strafe a small backward
        // projection. Keep that noise from reversing its legs every frame.
        this.backward=dx*Math.sin(pose.facing||0)+dz*Math.cos(pose.facing||0)<-travel*.15;
        const direction=Math.atan2(dx,dz)+(this.backward?Math.PI:0);
        this.targetYaw=clamp(angleDelta(this.facing,direction),-Math.PI/2,Math.PI/2);
      }
      this.backpedal=mix(this.backpedal,this.backward?1:0,1-Math.exp(-14*dt));
      this.lowerYaw=mix(this.lowerYaw,this.speed>.1&&!dead?this.targetYaw:0,1-Math.exp(-14*dt));
      if(!dead&&!airborne)this.phase=((this.phase+(this.backward?-1:1)*travel/mix(STRIDE,2.2,this.backpedal)*TAU)%TAU+TAU)%TAU;
    }
    if(this.wasAir&&!airborne&&!teleport)this.land=.1;
    this.land*=Math.exp(-16*dt);this.wasAir=airborne;
    this.blend=mix(this.blend,dead?0:clamp(this.speed/2.6,0,1),1-Math.exp(-16*dt));
    this.air=mix(this.air,airborne?1:0,1-Math.exp(-22*dt));
    this.attack=Math.max(0,this.attack-dt*3.8);
    const slopeX=heightAt(pose.x+.5,pose.z)-heightAt(pose.x-.5,pose.z),slopeZ=heightAt(pose.x,pose.z+.5)-heightAt(pose.x,pose.z-.5);
    const strideScale=1/(1+Math.hypot(slopeX,slopeZ)*2);
    const gait=this.blend*(1-this.air),feet=[],lowerYaw=this.lowerYaw*gait,torsoYaw=lowerYaw*.28;
    const lowerCos=Math.cos(lowerYaw),lowerSin=Math.sin(lowerYaw),c=Math.cos(this.facing),s=Math.sin(this.facing);
    const worldOffset=(x,z)=>{const bx=(x*lowerCos+z*lowerSin)*scaleX,bz=(-x*lowerSin+z*lowerCos)*scaleZ;return {x:bx*c+bz*s,z:-bx*s+bz*c};};
    let bob=.006*Math.sin(this.age*2.2)*(1-gait)+gait*(.015+.035*Math.cos(this.phase*2))-this.land;
    for(let i=0;i<2;i++){
      const cycle=(this.phase/TAU+i*.5)%1,stance=cycle<STANCE,swing=(cycle-STANCE)/(1-STANCE);
      const reach=mix(STRIDE,2.2,this.backpedal)*STANCE/2*strideScale;
      const z=(stance?mix(reach,-reach,cycle/STANCE):mix(-reach,reach,ease(swing)))*gait;
      const lift=stance?0:Math.sin(swing*Math.PI)*mix(.28,.16,this.backpedal)*gait;
      const x=(i===0?-1:1)*.17,offset=worldOffset(x,z);
      const wx=pose.x+offset.x,wz=pose.z+offset.z;
      const sampled=heightAt(wx,wz),footGround=Math.abs(sampled-ground)>.35?ground:sampled;
      const y=footGround-ground+SOLE+lift;
      feet.push({x,z,y,wx,wz});
      if(this.air<.1)bob=Math.min(bob,y+Math.sqrt(Math.max(.1,(LEG*2-.015)**2-z*z))-HIP);
    }
    bob=clamp(bob,-.3,.08);
    const legs=feet.map((foot,i)=>{
      const dy=foot.y-HIP-bob,d=clamp(Math.hypot(dy,foot.z),.1,LEG*2-.001);
      const bend=Math.acos(d/(LEG*2)),hip=Math.atan2(-foot.z,-dy)-bend,knee=2*bend;
      const offset=worldOffset(0,.15),span=Math.hypot(offset.x,offset.z)*2;
      const slope=clamp(Math.atan2(heightAt(foot.wx-offset.x,foot.wz-offset.z)-heightAt(foot.wx+offset.x,foot.wz+offset.z),span),-.5,.5);
      return {hip:mix(hip,i===0?-.55:.2,this.air),knee:mix(knee,i===0?1.1:.75,this.air),ankle:mix(-hip-knee+slope,-.2,this.air),...foot};
    });
    const attack=Math.sin((1-this.attack)*Math.PI)*Number(this.attack>0),swing=Math.sin(this.phase)*mix(.7,.4,this.backpedal)*gait;
    const cast=casting?1:0;
    this.last={x:pose.x,z:pose.z};
    return {speed:this.speed,phase:this.phase,blend:this.blend,facing:this.facing,air:this.air,legs,lowerYaw,torsoYaw,backpedal:this.backpedal,gaitDirection:this.backward?-1:1,
      bodyY:mix(bob,-.03,this.air),lean:gait*mix(.1,-.04,this.backpedal)*Math.cos(lowerYaw),roll:Math.sin(this.phase)*.025*gait,
      headYaw:-torsoYaw*.85+Math.sin(this.age*.7)*.07*(1-gait)*(1-this.air),
      leftArm:mix(-swing-.08+Math.sin(this.age*.8)*.025*(1-gait),-1.05,Math.max(cast,this.air*.65)),rightArm:mix(swing-.08+Math.sin(this.age*.8+1)*.025*(1-gait),-1.2,cast)-attack*1.6,
      elbow:.2+gait*.45+this.air*.3,cape:.12+gait*.35+this.air*.25+Math.sin(this.age*10)*.025*gait,dead};
  }
}

// Quadrupeds and guardians use the same local clock, with a distance-driven gait.
export class CreatureAnimator{
  constructor(){this.last=null;this.phase=0;this.speed=0;this.age=0;this.attack=0;}
  strike(){this.attack=1;}
  step(pose,dt,{dead=false,windup=false}={}){
    this.age+=dt;const d=this.last?Math.hypot(pose.x-this.last.x,pose.z-this.last.z):0;
    if(d>2){this.speed=0;this.phase=0;}else{this.speed=clamp(mix(this.speed,dt>0?d/dt:0,1-Math.exp(-12*dt)),0,8);if(!dead)this.phase=(this.phase+d/2.3*TAU)%TAU;}
    this.last={x:pose.x,z:pose.z};this.attack=Math.max(0,this.attack-dt*3);
    const move=dead?0:clamp(this.speed/2,0,1),attack=Math.sin((1-this.attack)*Math.PI)*Number(this.attack>0),idle=dead?0:1;
    return {phase:this.phase,move,bob:idle*(.018*Math.sin(this.age*1.7)+move*.035*Math.cos(this.phase*2)),head:idle*.035*Math.sin(this.age*.7)-attack*.25,lunge:attack*.18,attack,windup:windup?1:0};
  }
}
