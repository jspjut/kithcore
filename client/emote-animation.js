import {EMOTES} from '../shared/social.js';
const lerp=(a,b,t)=>a+(b-a)*t;
// Local continuous poses use replicated timestamps, never network-rate frames.
export function emotePose(emote,time){
 const e=EMOTES[emote?.id];if(!e)return null;const age=time-emote.startedAt,left=emote.endsAt-time;
 if(age<0||left<=0)return null;
 const weight=Math.min(1,age/.22,left/.3),phase=age*Math.PI*2,p={weight,bodyY:0,lean:0,roll:0,headX:0,headY:0,leftX:-.08,rightX:-.08,leftZ:-.1,rightZ:.1,elbow:.3};
 switch(e.id){
  case 'wave':p.rightZ=2.5+Math.sin(phase*2)*.3;p.rightX=-.45;p.elbow=.65;break;
  case 'bow':p.lean=Math.sin(Math.min(1,age/2.7)*Math.PI)*.75;p.headX=.22;p.leftX=p.rightX=-.15;break;
  case 'nod':p.headX=Math.sin(phase*1.7)*.2;break;
  case 'cheer':p.leftZ=-2.65;p.rightZ=2.65;p.leftX=p.rightX=-.3;p.bodyY=Math.max(0,Math.sin(phase*1.5))*.1;break;
  case 'laugh':p.lean=.12+Math.sin(phase*3)*.055;p.rightX=-1;p.elbow=1;p.headX=-.1;break;
  case 'point':p.rightX=-1.55;p.elbow=.03;p.headY=.1;break;
  case 'taunt':p.leftX=-1.3;p.leftZ=-.7;p.elbow=1.4;p.headY=Math.sin(phase)*.12;break;
  case 'soothe':p.leftX=p.rightX=-1.05;p.leftZ=-.4;p.rightZ=.4;p.elbow=.5+Math.sin(phase)*.15;p.lean=.12;break;
  case 'dance':p.leftZ=-1.1+Math.sin(phase)*.5;p.rightZ=1.1+Math.sin(phase)*.5;p.leftX=-.5+Math.cos(phase)*.6;p.rightX=-.5-Math.cos(phase)*.6;p.bodyY=Math.abs(Math.sin(phase))*.07;p.roll=Math.sin(phase)*.1;p.headY=Math.sin(phase)*.15;break;
  case 'salute':p.rightX=-2.3;p.rightZ=.5;p.elbow=1.6;break;
  case 'thank':p.rightX=-1.15;p.elbow=1.45;p.lean=.13;p.headX=.12;break;
  case 'shrug':p.leftZ=-.65;p.rightZ=.65;p.leftX=p.rightX=-.45;p.elbow=1.6;p.bodyY=Math.sin(Math.min(1,age/2.8)*Math.PI)*.035;break;
  case 'applaud':p.leftX=p.rightX=-1.05;p.leftZ=-.55-Math.sin(phase*2)*.18;p.rightZ=.55+Math.sin(phase*2)*.18;p.elbow=1.45;break;
  case 'yawn':p.rightX=-2.1;p.elbow=1.5;p.headX=-.18;p.leftZ=-.6;p.lean=-.07;break;
  case 'sniff':p.headX=Math.sin(phase*2)*.1;p.lean=.12;break;
  case 'growl':p.lean=.2;p.headX=-.12;p.leftZ=-.3;p.rightZ=.3;break;
  case 'sit':p.bodyY=-.48;p.lean=.08;p.sit=true;p.leftX=p.rightX=-.35;break;
 }
 return p;
}
export function applyEmote(rig,emote,time){const p=emotePose(emote,time);if(!p)return null;const w=p.weight;
 rig.body.position.y=lerp(rig.body.position.y,p.bodyY,w);rig.torso.rotation.x=lerp(rig.torso.rotation.x,p.lean,w);rig.torso.rotation.z=lerp(rig.torso.rotation.z,p.roll,w);rig.head.rotation.x=p.headX*w;rig.head.rotation.y+=p.headY*w;
 for(const [i,arm]of rig.arms.entries()){arm.shoulder.rotation.x=lerp(arm.shoulder.rotation.x,i?p.rightX:p.leftX,w);arm.shoulder.rotation.z=lerp(arm.shoulder.rotation.z,i?p.rightZ:p.leftZ,w);arm.elbow.rotation.x=lerp(arm.elbow.rotation.x,-p.elbow,w);}
 if(p.sit)for(const leg of rig.legs){leg.hip.rotation.x=lerp(leg.hip.rotation.x,-1.55,w);leg.knee.rotation.x=lerp(leg.knee.rotation.x,1.55,w);leg.ankle.rotation.x=lerp(leg.ankle.rotation.x,0,w);}
 return p;
}
