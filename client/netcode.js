import { MOVE_STEP, MAX_MOVE_QUEUE, advanceMotion, motionPose, normalizeInput } from '../shared/movement.js';
import { GLOBAL_COOLDOWN } from '../shared/content.js';

export class MovementPredictor {
  constructor() { this.reset(); }
  reset(p = null) {
    this.pose = p ? motionPose(p) : null;
    this.pending = []; this.unsent = []; this.sequence = p?.lastInputSeq || 0;
    this.epoch = p?.motionEpoch || 0; this.correction = { x: 0, z: 0, y: 0 };
    this.accumulator = 0; this.jumpQueued = false; this.lastSnapshotAt = 0;
  }
  jump() { this.jumpQueued = true; }
  advance(dt, x, z, now, facing) {
    if (!this.pose || now - this.lastSnapshotAt > 1500 || this.pending.length >= MAX_MOVE_QUEUE) return;
    this.accumulator = Math.min(.25, this.accumulator + Math.max(0, dt));
    const input = normalizeInput({ x, z, facing });
    if (!input) return;
    while (this.accumulator + 1e-9 >= MOVE_STEP && this.pending.length < MAX_MOVE_QUEUE) {
      const command = { seq: ++this.sequence, ...input, jump: this.jumpQueued };
      this.jumpQueued = false;
      advanceMotion(this.pose, command);
      this.pending.push(command); this.unsent.push(command); this.accumulator -= MOVE_STEP;
    }
    const decay = Math.exp(-dt * 18);
    this.correction.x *= decay; this.correction.z *= decay; this.correction.y *= decay;
  }
  flush(send) {
    while (this.unsent.length) {
      const commands = this.unsent.slice(0, 6);
      if (send({ type: 'move', epoch: this.epoch, commands }) === false) return;
      this.unsent.splice(0, commands.length);
    }
  }
  reconcile(self, now) {
    if (!this.pose || self.motionEpoch !== this.epoch || self.hp <= 0) {
      this.reset(self); this.lastSnapshotAt = now; return;
    }
    const old = this.visual();
    this.pending = this.pending.filter(c => c.seq > self.lastInputSeq);
    this.unsent = this.unsent.filter(c => c.seq > self.lastInputSeq);
    this.pose = motionPose(self);
    for (const command of this.pending) advanceMotion(this.pose, command);
    const error = Math.hypot(old.x - this.pose.x, old.z - this.pose.z);
    // Small corrections are visual only; collisions always use the reconciled pose.
    this.correction = error < 2 ? { x: old.x - this.pose.x, z: old.z - this.pose.z, y: old.y - this.pose.y } : { x: 0, z: 0, y: 0 };
    this.lastSnapshotAt = now;
  }
  visual() {
    if (!this.pose) return null;
    return { ...this.pose, x: this.pose.x + this.correction.x, z: this.pose.z + this.correction.z, y:this.pose.grounded?Math.max(this.pose.y,this.pose.y+this.correction.y):this.pose.y+this.correction.y };
  }
}

export class NetworkClock {
  constructor() { this.reset(); }
  reset() { this.offset = null; this.rtt = null; this.samples = []; }
  observe(time, now) { if (this.offset === null) this.offset = time - now / 1000; }
  pong(sent, time, now) {
    const rtt = now - sent;
    if (!Number.isFinite(rtt) || rtt < 0 || rtt > 5000 || !Number.isFinite(time)) return;
    this.rtt = this.rtt === null ? rtt : this.rtt * .7 + rtt * .3;
    this.samples.push({ rtt, offset: time - (sent + now) / 2000 });
    if (this.samples.length > 8) this.samples.shift();
    const best = this.samples.reduce((a,b)=>a.rtt < b.rtt ? a : b);
    this.offset = best.offset;
  }
  time(now) { return now / 1000 + (this.offset || 0); }
}

export class SnapshotInterpolator {
  constructor(delay = .1) { this.delay = delay; this.samples = new Map(); }
  push(snapshot) {
    const alive = new Set();
    for (const entity of [...snapshot.players,...snapshot.enemies,...(snapshot.npcs||[])]) {
      alive.add(entity.id); const history = this.samples.get(entity.id) || [];
      if (!history.length || snapshot.time > history.at(-1).time) history.push({ ...motionPose(entity), inTransit:!!entity.inTransit, time: snapshot.time });
      while (history.length > 12) history.shift(); this.samples.set(entity.id, history);
    }
    for (const id of this.samples.keys()) if (!alive.has(id)) this.samples.delete(id);
  }
  sample(id, serverTime) {
    const history = this.samples.get(id); if (!history?.length) return null;
    const time = serverTime - this.delay;
    if(time<=history[0].time)return history[0];
    let a = history[Math.max(0,history.length-2)], b = history.at(-1);
    for (let i = 1; i < history.length; i++) if (history[i].time >= time) { a = history[i-1]; b = history[i]; break; }
    if (time < a.time || history.length === 1) return a;
    const span = b.time - a.time;
    if (span <= 0) return b;
    // Interpolate snapshots; extrapolate at most 100 ms during jitter.
    const t = Math.max(0, Math.min(1 + .1 / span, (time - a.time) / span));
    if (Math.hypot(b.x-a.x,b.z-a.z)>(a.inTransit&&b.inTransit?Math.max(8,150*span):8)) return b;
    const angle = Math.atan2(Math.sin(b.facing-a.facing),Math.cos(b.facing-a.facing));
    return { y:a.y+(b.y-a.y)*Math.min(1,t),grounded:t<1?a.grounded&&b.grounded:b.grounded,supportId:t<.5?a.supportId:b.supportId,x:a.x+(b.x-a.x)*t, z:a.z+(b.z-a.z)*t, facing:a.facing+angle*Math.min(1,t), jumpHeight:Math.max(0,a.jumpHeight+(b.jumpHeight-a.jumpHeight)*Math.min(1,t)) };
  }
}

export class CastPresentation {
  constructor() { this.current = null; this.sequence = 0; this.epoch = null; this.cancelledThrough=0; }
  start(skill, definition, now, requestId=null) {
    if (!definition.castTime || this.current) return null;
    if(requestId===null)requestId=++this.sequence;else this.sequence=Math.max(this.sequence,requestId);
    this.current = { skill, name:definition.name, requestId, started: now, duration: definition.castTime, confirmed: false };
    return this.current;
  }
  reconcile(self, now, serverTime) {
    if (this.epoch !== self.motionEpoch) { this.current = null; this.epoch = self.motionEpoch;this.cancelledThrough=0; }
    if (self.hp <= 0) { this.current = null; return; }
    if (self.casting) {
      if(self.casting.requestId<=this.cancelledThrough)return;
      if (this.current?.requestId === self.casting.requestId && this.current.skill === self.casting.skill) this.current.confirmed = true;
      else this.current = { skill:self.casting.skill, name:self.casting.name, requestId:self.casting.requestId, started:now-(serverTime-self.casting.startedAt)*1000, duration:self.casting.endsAt-self.casting.startedAt, confirmed:true };
    } else if (this.current && (this.current.confirmed || self.lastCastRequest >= this.current.requestId)) this.current = null;
  }
  cancel() { if(this.current)this.cancelledThrough=Math.max(this.cancelledThrough,this.current.requestId);this.current = null; }
  progress(now) { const c=this.current;return c?Math.max(0,Math.min(1,(now-c.started)/(c.duration*1000))):0; }
}

export class GlobalCooldownPresentation{
  constructor(){this.reset();}
  reset(){this.current=null;this.epoch=null;this.cancelledThrough=0;}
  start(requestId,now){this.current={requestId,started:now,ends:now+GLOBAL_COOLDOWN*1000,confirmed:false};}
  cancelCast(requestId){this.cancelledThrough=Math.max(this.cancelledThrough,requestId);if(this.current?.requestId===requestId)this.current=null;}
  reconcile(self,now,serverTime){
    if(this.epoch!==self.motionEpoch){this.current=null;this.cancelledThrough=0;this.epoch=self.motionEpoch;}
    if(self.hp<=0){this.current=null;return;}
    // An older snapshot must not erase a locally started ability's sweep.
    if(this.current&&!this.current.confirmed&&self.lastCastRequest<this.current.requestId)return;
    const authoritative=self.globalCooldown;
    if(authoritative&&authoritative.requestId>this.cancelledThrough&&authoritative.endsAt>serverTime){
      const ends=now+(authoritative.endsAt-serverTime)*1000;
      this.current={requestId:authoritative.requestId,started:ends-GLOBAL_COOLDOWN*1000,ends,confirmed:true};
    }else this.current=null;
  }
  remaining(now){return this.current?Math.max(0,(this.current.ends-now)/1000):0;}
}
