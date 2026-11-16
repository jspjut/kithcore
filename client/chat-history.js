// Session-only history. Never carries messages or drafts between characters.
export class ChatHistory{
 constructor(){this.reset();}
 reset(){this.messages=[];this.conversations=new Map();this.active='all';this.publicDraft='';this.whisperDraft='';this.sequence=0;}
 key(name){return `whisper:${name.trim().toLowerCase()}`;}
 conversation(name){const key=this.key(name);let c=this.conversations.get(key);if(!c){c={key,name:name.trim(),unread:0,draft:'',open:true,last:++this.sequence};this.conversations.set(key,c);}c.open=true;return c;}
 append(message,selfId,{viewing=true}={}){
  const m={...message,sequence:++this.sequence};
  if(m.channel==='whisper'){
   const outgoing=m.source===selfId,name=outgoing?m.targetName:m.name;if(!name)return;
   const c=this.conversation(name);c.name=name;c.id=outgoing?m.target:m.source;c.last=m.sequence;m.conversation=c.key;
   if(!outgoing&&!(viewing&&(this.active===c.key||this.active==='whispers')))c.unread++;
  }
  this.messages.push(m);if(this.messages.length>500)this.messages.splice(0,this.messages.length-500);
  if(this.conversations.size>50){const oldest=[...this.conversations.values()].filter(c=>c.key!==this.active).sort((a,b)=>Number(a.open)-Number(b.open)||a.last-b.last)[0];if(oldest){this.conversations.delete(oldest.key);this.messages=this.messages.filter(m=>m.conversation!==oldest.key);}}
  return m;
 }
 visible(){return this.messages.filter(m=>this.active==='all'||this.active==='whispers'&&m.channel==='whisper'||m.conversation===this.active);}
 select(key){if(key!=='all'&&key!=='whispers'&&!this.conversations.has(key))return false;this.active=key;this.markRead();return true;}
 markRead(){for(const c of this.conversations.values())if(this.active==='whispers'||c.key===this.active)c.unread=0;}
 close(key){const c=this.conversations.get(key);if(!c)return;c.open=false;c.unread=0;if(this.active===key)this.active='all';}
 get recipient(){return this.conversations.get(this.active)?.name||null;}
 get unread(){return [...this.conversations.values()].reduce((n,c)=>n+c.unread,0);}
 get draft(){return this.active==='all'?this.publicDraft:this.active==='whispers'?this.whisperDraft:this.conversations.get(this.active)?.draft||'';}
 set draft(value){if(this.active==='all')this.publicDraft=value;else if(this.active==='whispers')this.whisperDraft=value;else{const c=this.conversations.get(this.active);if(c)c.draft=value;}}
}
