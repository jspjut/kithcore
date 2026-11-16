import {WORLD_INFO} from '../shared/world-info.js';
import {ITEMS,STACK_SIZE,storedItemCount} from '/shared/content.js';
import {MAIL_ATTACHMENTS} from '/shared/mail.js';
import {icon} from './ui.js';
const requestId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class CorrespondenceUI{
 constructor({ui,send,getState,whisper}){Object.assign(this,{ui,send,getState,whisper});this.draft={name:'',subject:'',body:'',attachments:[],requestId:requestId()};this.tab='inbox';ui.correspondence=this;document.addEventListener('pointerdown',e=>{if(!e.target.closest('#player-context-menu'))this.closeContext();});}
 get p(){return this.getState()?.self;}
 reset(){this.closeContext();this.mail=null;this.draft={name:'',subject:'',body:'',attachments:[],requestId:requestId()};this.friendSignature='';this.tab='inbox';this.selected=null;}
 update(){
  const s=this.p?.correspondence;if(!s)return;
  const badge=document.querySelector('#unread-mail');badge.textContent=s.unreadMail?`✉ ${s.unreadMail}`:'';badge.classList.toggle('hidden',!s.unreadMail);document.querySelector('#friends-button').title=`Friends${s.unreadMail?` · ${s.unreadMail} unread letter${s.unreadMail===1?'':'s'}`:''}`;
  if(this.ui.windows.get('mail')&&s.mailbox!==this.mail?.mailbox)this.ui.windows.close('mail');
  const signature=JSON.stringify([s.friends,s.unreadMail]);if(signature!==this.friendSignature){this.friendSignature=signature;if(this.ui.windows.get('friends'))this.renderFriends();}
 }
 openAddFriend(){if(!this.ui.windows.get('friends'))this.toggleFriends();const input=this.ui.windows.get('friends').body.querySelector('[name="name"]');input.focus();}
 toggleFriends(){if(this.ui.windows.get('friends'))return this.ui.windows.close('friends');this.ui.windows.open('friends','Friends & correspondence',{width:370,left:30,top:110});this.renderFriends();}
 renderFriends(){
  const w=this.ui.windows.get('friends');if(!w)return;
  w.body.innerHTML=`<form id="add-friend-form" class="correspondence-form"><label>Character name<input name="name" maxlength="18" required autocomplete="off"></label><button type="submit">Add friend</button></form><div class="friends-list">${(this.p.correspondence?.friends||[]).map(f=>`<article class="friend-row ${f.online?'online':''}" data-friend="${f.id}"><strong>${esc(f.name)}</strong><small>${f.online?`Online · Level ${f.level} · ${WORLD_INFO.zoneNames[f.mapId]||f.mapId}`:'Offline'}</small><div><button data-whisper="${esc(f.name)}" ${f.online?'':'disabled'}>Whisper</button><button data-party="${f.id}" ${f.online?'':'disabled'}>Invite</button><button data-write="${esc(f.name)}">Write</button><button data-remove="${f.id}" aria-label="Remove ${esc(f.name)}">×</button></div></article>`).join('')||'<p>No friends added yet. Use /friend name or right-click a player’s target portrait.</p>'}</div><p class="window-footnote">Friends are saved per character. Whisper to online friends anywhere; send letters and items at a town mailbox. ✉ ${this.p.correspondence?.unreadMail||0} unread.<br>/w or /whisper name message · /z or /zone · /y or /yell</p>`;
  w.body.querySelector('form').onsubmit=e=>{e.preventDefault();const input=e.target.elements.name;this.send({type:'friend',action:'add',name:input.value});input.value='';};
  w.body.querySelectorAll('[data-whisper]').forEach(b=>b.onclick=()=>this.whisper(b.dataset.whisper));w.body.querySelectorAll('[data-party]').forEach(b=>b.onclick=()=>this.send({type:'party',action:'invite',id:b.dataset.party}));w.body.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>this.send({type:'friend',action:'remove',id:b.dataset.remove}));
  w.body.querySelectorAll('[data-write]').forEach(b=>b.onclick=()=>{this.draft.name=b.dataset.write;this.tab='compose';if(this.ui.windows.get('mail'))this.renderMail();else this.ui.toast('Visit a mailbox beside a town or city waypoint to send this letter.');});
 }
 contextMenu(player,x,y){
  this.closeContext();const el=document.createElement('div');el.id='player-context-menu';el.className='player-context-menu';el.setAttribute('role','menu');
  const friend=this.p.correspondence?.friends.some(f=>f.id===player.id),canInvite=(!this.getState().party||this.getState().party.leader===this.p.id)&&!this.getState().party?.members.includes(player.id);
  el.innerHTML=`<strong>${esc(player.name)}</strong><button data-action="whisper">Whisper</button><button data-action="friend">${friend?'Remove friend':'Add friend'}</button><button data-action="party" ${canInvite?'':'disabled'}>Invite to party</button>`;
  el.style.left=`${Math.max(8,Math.min(innerWidth-190,x))}px`;el.style.top=`${Math.max(8,Math.min(innerHeight-160,y))}px`;document.body.append(el);this.context=el;
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='whisper')this.whisper(player.name);if(a==='friend')this.send({type:'friend',action:friend?'remove':'add',id:player.id});if(a==='party')this.send({type:'party',action:'invite',id:player.id});this.closeContext();});
 }
 closeContext(){this.context?.remove();this.context=null;}
 openMail(message){
  this.mail=message;if(message.sent){this.draft={name:'',subject:'',body:'',attachments:[],requestId:requestId()};this.tab='inbox';}
  const existing=this.ui.windows.get('mail');this.ui.windows.close('bank');this.ui.windows.close('merchant');this.ui.windows.close('dialogue');
  const w=this.ui.windows.open('mail','Town post',{width:460,left:30,top:100,paper:true});w.onClose=()=>{this.send({type:'mail',action:'close'});this.ui.renderBags();};
  if(!existing||this.tab!=='compose'||message.sent)this.renderMail();
 }
 attach(item,count=1){
  if(this.tab!=='compose'||!this.ui.windows.get('mail'))return false;
  const def=ITEMS[item],reserved=this.draft.attachments.filter(a=>a.item===item).reduce((n,a)=>n+a.count,0),available=storedItemCount(this.p,item)-reserved;
  if(!def||def.quest||def.npcOnly||available<1){this.ui.toast('Choose an unequipped item from your bags. Quest items cannot be mailed.');return true;}
  if(this.draft.attachments.length>=MAIL_ATTACHMENTS){this.ui.toast('A letter can hold six stacks.');return true;}
  this.draft.attachments.push({item,count:Math.min(Math.max(1,count),available,def.slot||def.bagSlots?1:STACK_SIZE)});this.renderMail();return true;
 }
 renderMail(){
  const w=this.ui.windows.get('mail');if(!w||!this.mail)return;
  const letters=this.mail.letters,selected=letters.find(m=>m.id===this.selected);
  w.body.innerHTML=`<nav class="book-tabs"><button data-mail-tab="inbox" class="${this.tab==='inbox'?'selected':''}">Inbox (${letters.length})</button><button data-mail-tab="compose" class="${this.tab==='compose'?'selected':''}">Write a letter</button></nav><div id="mail-content"></div><p class="window-footnote">Post is delivered immediately, including to offline characters.<br>Walk away to close. Letters stay until deleted; collect attachments first.</p>`;
  w.body.querySelectorAll('[data-mail-tab]').forEach(b=>b.onclick=()=>{this.tab=b.dataset.mailTab;this.renderMail();});const content=w.body.querySelector('#mail-content');
  if(this.tab==='compose'){
   const d=this.draft,items=Object.keys(this.p.inventory).filter(id=>ITEMS[id]&&!ITEMS[id].quest&&!ITEMS[id].npcOnly&&storedItemCount(this.p,id)>0);
   content.innerHTML=`<form id="mail-compose" class="correspondence-form"><label>To<input name="name" maxlength="18" required value="${esc(d.name)}" list="mail-friends" autocomplete="off"></label><datalist id="mail-friends">${(this.p.correspondence?.friends||[]).map(f=>`<option value="${esc(f.name)}">`).join('')}</datalist><label>Subject<input name="subject" maxlength="80" required value="${esc(d.subject)}"></label><label>Letter<textarea name="body" maxlength="2000" rows="5">${esc(d.body)}</textarea></label><div class="mail-attachments">${d.attachments.map((a,i)=>`<button type="button" data-detach="${i}" data-transaction="detach" data-item="${a.item}" title="Remove attachment">${icon(a.item)}<span>${esc(ITEMS[a.item].name)} ×${a.count}</span> ×</button>`).join('')}</div><div class="mail-attach-controls"><select name="item" aria-label="Attachment item">${items.map(id=>`<option value="${id}">${esc(ITEMS[id].name)}</option>`).join('')}</select><input name="count" type="number" min="1" max="${STACK_SIZE}" value="1" aria-label="Attachment amount"><button type="button" id="mail-attach">Attach</button></div><p class="window-footnote">Up to six stacks. Items leave your bags when sent. You can also right-click bag items to attach them.</p><button type="submit" id="mail-send">Send letter</button></form>`;
   const form=content.querySelector('form');for(const key of ['name','subject','body'])form.elements[key].oninput=()=>{d[key]=form.elements[key].value;};
   form.onsubmit=e=>{e.preventDefault();const message={type:'mail',action:'send',...d};if(new TextEncoder().encode(JSON.stringify(message)).length>4000){this.ui.toast('This letter is too long. Shorten its text or split it into two letters.');return;}this.send(message);};form.querySelector('#mail-attach').onclick=()=>this.attach(form.elements.item.value,Number(form.elements.count.value)||1);
   form.querySelectorAll('[data-detach]').forEach(b=>b.onclick=()=>{d.attachments.splice(Number(b.dataset.detach),1);this.renderMail();});
  }else{
   content.innerHTML=`<div class="mail-list">${letters.map(m=>`<button data-letter="${m.id}" class="${m.read?'':'unread'} ${m.id===this.selected?'selected':''}"><strong>${m.attachments.length?'▣':'✉'} ${esc(m.subject)}</strong><span>${esc(m.sender)} · ${esc(new Date(m.sentAt).toLocaleDateString())}</span></button>`).join('')||'<p>Your mailbox is empty.</p>'}</div>${selected?`<article class="mail-letter"><h3>${esc(selected.subject)}</h3><small>From ${esc(selected.sender)}</small><p>${esc(selected.body)}</p><div class="mail-attachments">${selected.attachments.map(a=>`<span data-transaction="mailItem" data-item="${a.item}">${icon(a.item)} ${esc(ITEMS[a.item]?.name||a.item)} ×${a.count}</span>`).join('')}</div>${selected.attachments.length?'<button id="mail-claim">Collect attachments</button>':'<button id="mail-delete">Delete letter</button>'}</article>`:''}`;
   content.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{this.selected=b.dataset.letter;this.send({type:'mail',action:'read',id:this.selected});});
   const claim=content.querySelector('#mail-claim');if(claim)claim.onclick=()=>this.send({type:'mail',action:'claim',id:this.selected});
   const del=content.querySelector('#mail-delete');if(del)del.onclick=()=>{if(del.dataset.confirm)this.send({type:'mail',action:'delete',id:this.selected});else{del.dataset.confirm='true';del.textContent='Confirm delete';}};
  }
  this.ui.renderBags();
 }
}
