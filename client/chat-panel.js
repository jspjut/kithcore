import {storageKey} from '../shared/world-storage.js';
import {ChatHistory} from './chat-history.js';
import {CHAT_CHANNELS,parseChat} from '/shared/chat.js';
const $=s=>document.querySelector(s);
export class ChatPanel{
 constructor({chat,getState,send,onOpen}){
  Object.assign(this,{chat,getState,send,onOpen});this.history=new ChatHistory();this.scrolls=new Map();this.root=$('#chat');this.log=$('#chat-messages');this.input=$('#chat-input');this.tabs=$('#chat-tabs');
  chat.onSend=(text,channel)=>this.submit(text,channel);chat.openWhisper=name=>this.startWhisper(name);
  this.input.addEventListener('input',()=>{this.history.draft=this.input.value;});
  $('#chat-send').onpointerdown=e=>e.preventDefault();$('#chat-send').onclick=()=>chat.submit();
  $('#chat-write').onclick=()=>chat.open();$('#chat-new-whisper').onclick=()=>this.openPicker();
  $('#chat-whisper-cancel').onclick=()=>this.closePicker();$('#chat-whisper-name').oninput=()=>this.renderPeople();
  $('#chat-whisper-form').onsubmit=e=>{e.preventDefault();const name=$('#chat-whisper-name').value.trim();if(name.length>=2)this.startWhisper(name);};
  $('#chat-whisper-name').onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();this.closePicker();this.input.focus();}};
  chat.channelSelect.addEventListener('change',()=>{if(this.history.active!=='all')this.select('all');this.renderRoute();});
  this.log.addEventListener('scroll',()=>{const bottom=this.atBottom();$('#chat-jump').classList.toggle('hidden',bottom);if(bottom&&document.hasFocus()){this.history.markRead();this.renderTabs();}});
  $('#chat-jump').onclick=()=>{this.log.scrollTop=this.log.scrollHeight;this.history.markRead();this.renderTabs();};
  window.addEventListener('focus',()=>{if(this.atBottom()){this.history.markRead();this.renderTabs();}});
  this.bindResize();this.renderTabs();this.renderRoute();
 }
 resume(){this.input.classList.remove('hidden');this.renderRoute();}
 get p(){return this.getState()?.self;}
 atBottom(){return this.log.scrollHeight-this.log.clientHeight-this.log.scrollTop<24;}
 reset(){this.history.reset();this.lastSubmitted=null;this.scrolls.clear();this.closePicker();this.log.replaceChildren();this.input.value='';this.chat.setChannel('say');this.renderTabs();this.renderRoute();}
 add(message){
  const follow=this.atBottom(),m=this.history.append(message,this.p?.id,{viewing:follow&&document.hasFocus()&&!document.hidden});if(!m)return;
  this.renderTabs();if(this.history.active==='all'||this.history.active==='whispers'&&m.channel==='whisper'||m.conversation===this.history.active)this.renderMessages(follow);
 }
 select(key){
  this.history.draft=this.input.value;this.scrolls.set(this.history.active,this.log.scrollTop);if(!this.history.select(key))return;
  this.input.value=this.history.draft;this.chat.hideSuggestions();this.renderTabs();this.renderRoute();this.renderMessages(false);
  const scroll=this.scrolls.get(key);this.log.scrollTop=scroll??this.log.scrollHeight;$('#chat-jump').classList.toggle('hidden',this.atBottom());
  this.tabs.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 startWhisper(name){
  const pending=this.history.active==='whispers'?this.input.value:'';const c=this.history.conversation(name);this.select(c.key);if(pending&&!this.input.value){this.input.value=pending;this.history.draft=pending;}
  this.closePicker();this.chat.open();
 }
 openPicker(){this.onOpen();$('#chat-whisper-picker').classList.remove('hidden');$('#chat-new-whisper').setAttribute('aria-expanded','true');$('#chat-whisper-name').value='';this.renderPeople();$('#chat-whisper-name').focus();}
 closePicker(){$('#chat-whisper-picker').classList.add('hidden');$('#chat-new-whisper').setAttribute('aria-expanded','false');}
 people(){
  const state=this.getState(),people=new Map(),add=(name,detail)=>{if(name&&name!==this.p?.name&&!people.has(name.toLowerCase()))people.set(name.toLowerCase(),{name,detail});};
  const target=state?.players.find(p=>p.id===state.self.target&&p.id!==state.self.id);if(target)add(target.name,'Selected player');
  for(const f of this.p?.correspondence?.friends||[])if(f.online)add(f.name,'Online friend');
  for(const c of [...this.history.conversations.values()].sort((a,b)=>b.last-a.last))add(c.name,'Recent conversation');
  for(const p of state?.players||[])if(p.id!==this.p?.id)add(p.name,'In your area');return [...people.values()];
 }
 renderPeople(){
  const query=$('#chat-whisper-name').value.trim().toLowerCase(),list=$('#chat-whisper-people');list.replaceChildren();
  for(const p of this.people().filter(p=>p.name.toLowerCase().includes(query)).slice(0,8)){const b=document.createElement('button'),name=document.createElement('strong'),detail=document.createElement('small');b.type='button';b.dataset.whisperPerson=p.name;name.textContent=p.name;detail.textContent=p.detail;b.append(name,detail);b.onclick=()=>this.startWhisper(p.name);list.append(b);}
  if(!list.children.length){const hint=document.createElement('p');hint.textContent='Enter a full character name to whisper someone anywhere in the world.';list.append(hint);}
 }
 submit(text,channel){
  const parsed=parseChat(text,channel),recipient=this.history.recipient,slash=text.startsWith('/');
  if(!slash&&this.history.active==='whispers'){this.openPicker();return false;}
  this.lastSubmitted={key:this.history.active,text};const sent=this.send(text,channel,!slash?recipient:null);if(sent===false)return false;
  this.history.draft='';this.input.value='';
  if(slash&&parsed&&parsed.channel!=='whisper'){this.select('all');this.chat.setChannel(parsed.channel);}
  this.renderRoute();return true;
 }
 rejected(message){
  const key=message.whisperTo?this.history.conversation(message.whisperTo).key:this.lastSubmitted?.text===message.attempt?this.lastSubmitted.key:'all';
  const draft=this.history.conversations.get(key);if(draft&&!draft.draft)draft.draft=message.attempt;else if(key==='all'&&!this.history.publicDraft)this.history.publicDraft=message.attempt;
  if(this.history.active===key&&!this.input.value)this.input.value=this.history.draft;
  this.add({system:true,deliveryError:true,text:message.text,conversation:key==='all'?undefined:key});
 }
 renderTabs(){
  const focus=this.tabs.querySelector(':focus')?.dataset.chatTab;this.tabs.replaceChildren();
  const entries=[{key:'all',name:'All'},{key:'whispers',name:'Whispers',unread:this.history.unread},...[...this.history.conversations.values()].filter(c=>c.open)];
  for(const c of entries){const wrap=document.createElement('div');wrap.className='chat-tab-wrap';const b=document.createElement('button');b.type='button';b.role='tab';b.dataset.chatTab=c.key;b.setAttribute('aria-selected',String(c.key===this.history.active));b.setAttribute('aria-controls','chat-messages');b.tabIndex=c.key===this.history.active?0:-1;b.title=c.name;b.textContent=c.name;
   if(c.unread){const unread=document.createElement('span');unread.className='chat-unread';unread.textContent=String(c.unread);b.append(unread);b.setAttribute('aria-label',`${c.name}, ${c.unread} unread`);}
   b.onclick=()=>this.select(c.key);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const i=entries.findIndex(v=>v.key===c.key),next=e.key==='Home'?0:e.key==='End'?entries.length-1:(i+(e.key==='ArrowRight'?1:-1)+entries.length)%entries.length;this.select(entries[next].key);[...this.tabs.querySelectorAll('[data-chat-tab]')][next]?.focus();}};wrap.append(b);
   if(c.key.startsWith('whisper:')){const close=document.createElement('button');close.type='button';close.className='chat-tab-close';close.setAttribute('aria-label',`Close conversation with ${c.name}`);close.textContent='×';close.onclick=()=>{if(this.history.active===c.key)this.select('all');this.history.close(c.key);this.renderTabs();};wrap.append(close);}this.tabs.append(wrap);
  }
  if(focus)this.tabs.querySelectorAll('[data-chat-tab]').forEach(b=>{if(b.dataset.chatTab===focus)b.focus({preventScroll:true});});
 }
 renderRoute(){
  const recipient=this.history.recipient,c=CHAT_CHANNELS[this.chat.channel];this.root.classList.toggle('whispering',!!recipient);this.chat.channelSelect.classList.toggle('hidden',!!recipient||this.history.active==='whispers');
  $('#chat-route').textContent=recipient?`To ${recipient}`:this.history.active==='whispers'?'Whispers · Choose a player':`${c.name}${c.range?` · ${c.range} paces`:''}`;
  this.input.maxLength=200;this.input.placeholder=recipient?`Whisper to ${recipient}…`:this.history.active==='whispers'?'Start a whisper or choose a conversation…':`${c.name} · Enter to send, / for commands`;
  this.input.setAttribute('aria-label',recipient?`Whisper to ${recipient}`:'Chat message');$('#chat-send').textContent=recipient?'Whisper':'Send';
 }
 renderMessages(follow=true){
  const top=this.log.scrollTop;this.log.replaceChildren();for(const m of this.history.visible()){
   const el=document.createElement('div');el.className=`chat-line${m.system?' system':''}${m.emote?' emote':''}${m.ambient?' ambient-social':''}${m.npcSpeech?' npc-speech':''}`;
   el.classList.toggle('delivery-error',!!m.deliveryError);
   const channel=m.channel||m.npcSpeech&&'say';if(channel){el.classList.add(`channel-${channel}`);const label=document.createElement('span');label.className='chat-channel-label';label.textContent=channel==='whisper'?`[${m.source===this.p?.id?'To '+m.targetName:'From '+m.name}] `:`[${CHAT_CHANNELS[channel]?.name||'Say'}] `;el.append(label);}
   if(!m.system){const name=document.createElement('strong');name.textContent=channel==='whisper'?'':`${m.name}: `;if(channel==='whisper'){const b=document.createElement('button');b.className='chat-whisper-link';b.textContent='Reply';b.title=`Open conversation with ${m.source===this.p?.id?m.targetName:m.name}`;b.onclick=()=>this.startWhisper(m.source===this.p?.id?m.targetName:m.name);el.append(b,document.createTextNode(' '));}else el.append(name);}
   el.append(document.createTextNode(m.text));this.log.append(el);
  }
  this.log.scrollTop=follow?this.log.scrollHeight:top;$('#chat-jump').classList.toggle('hidden',this.atBottom());
 }
 bindResize(){
  let size;try{size=JSON.parse(localStorage.getItem(storageKey('chat-size')));}catch{}
  const apply=(w,h)=>{this.root.style.width=`${Math.min(innerWidth-32,Math.max(300,w))}px`;this.root.style.height=`${Math.min(innerHeight-175,Math.max(220,h))}px`;};
  if(size&&Number.isFinite(size.width)&&Number.isFinite(size.height))apply(size.width,size.height);
  const grip=$('#chat-resize');let drag;
  grip.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();this.onOpen();const r=this.root.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,w:r.width,h:r.height};grip.setPointerCapture(e.pointerId);};
  grip.onpointermove=e=>{if(drag)apply(drag.w+e.clientX-drag.x,drag.h+drag.y-e.clientY);};
  const finish=()=>{if(!drag)return;drag=null;const r=this.root.getBoundingClientRect();try{localStorage.setItem(storageKey('chat-size'),JSON.stringify({width:r.width,height:r.height}));}catch{}};grip.onpointerup=grip.onpointercancel=finish;
  grip.onkeydown=e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const r=this.root.getBoundingClientRect();apply(r.width+(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0),r.height+(e.key==='ArrowUp'?20:e.key==='ArrowDown'?-20:0));try{localStorage.setItem(storageKey('chat-size'),JSON.stringify({width:this.root.offsetWidth,height:this.root.offsetHeight}));}catch{}};
  window.addEventListener('resize',()=>{const r=this.root.getBoundingClientRect();if(this.root.style.width)apply(r.width,r.height);});
 }
}
