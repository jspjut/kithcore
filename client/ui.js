import {atlasPoint,bindAtlasZoom} from './atlas-navigation.js';
import {renderFlightMap} from './flight-map.js';
import {itemIcon} from './item-icons.js';
import {TRAVEL_NODES} from '/shared/travel-network.js';
import {npcGreeting,UI_CONFIG} from './world-ui.js';
import {LIVE_DIALOGUE} from '/shared/live-content.js';
import {storageKey} from '../shared/world-storage.js';
import {capitalTopics} from '/shared/capital-story.js';
import {WAYPOINTS} from '/shared/travel.js';
import {STORY_GREETINGS} from '/shared/story-content.js';
import {renderAbilityBook} from './spellbook.js';
import {EMOTES,knowsEmote,actionEmote} from '/shared/social.js';
import {emoteIcon,renderReputation,characterTabs} from './social-ui.js';
import {bankEntries} from '/shared/storage.js';
import { ITEMS, GLOBAL_COOLDOWN, SKILLS, QUESTS, NPCS, EQUIPMENT_SLOTS, equipmentSlot, compatibleEquipmentSlots, canEquipInSlot, BAG_CAPACITY, BAG_EQUIP_SLOTS, MERCHANT_STOCK, inventoryCapacity, bagContainers, bagEntries, questRecord, questReady, questDone, questAvailable, questForPlayer,activeQuests, dialogueQuests } from '/shared/content.js';
import {ATLAS_SIZE,STARTING_MAP,atlasMap,atlasTrail,atlasChildren,atlasHit} from '/shared/atlas.js';
import {hitAtlasQuest} from './atlas-quests.js';
import {applyRarityTheme} from './rarity-theme.js';
import {classDefinition,classSkills,learnedSkill,armorAllowed} from '/shared/adventurers.js';
import {RARITIES} from '/shared/progression.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconName=id=>ITEMS[id]?.iconId?iconName(ITEMS[id].iconId):ITEMS[id]?.bagSlots?'bag':id==='sunmint'?'seed':id==='copper_ore'?'resin':SKILLS[id]?(SKILLS[id].iconId||id):id==='auto'?'sword':id==='potion'?'potion':id==='resin'?'resin':id==='splinter'||id==='dawnsteel_fragment'?'crystal':ITEMS[id]?.slot?(compatibleEquipmentSlots(id)[0]?.icon||'armor'):ITEMS[id]?.quest?'seed':id;
export const icon=id=>ITEMS[id]&&(ITEMS[id].appearance||ITEMS[id].slot)?itemIcon(ITEMS[id]):actionEmote(id)?emoteIcon(actionEmote(id)):`<svg class="game-icon" aria-hidden="true" viewBox="0 0 64 64"><use href="/icons.svg#${iconName(id)}"/></svg>`;
export function money(value){const n=Math.max(0,Math.floor(value));return `${n>=10000?`<span class="coin gold">${Math.floor(n/10000)}<i></i></span>`:''}${n>=100?`<span class="coin silver">${Math.floor(n/100)%100}<i></i></span>`:''}<span class="coin copper">${n%100}<i></i></span>`;}
const DEFAULT_BAR=[null,null,null,null,'potion','auto',null,null,null,null,null,null];
const KEYS=['1','2','3','4','5','6','7','8','9','0','-','='];
const validAction=id=>id===null||id==='auto'||!!ITEMS[id]?.consumable||Object.hasOwn(SKILLS,id)||!!actionEmote(id);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const atlasWindowWidth=()=>Math.min(900,innerWidth-32,Math.max(350,(innerHeight-280)/.72+32));
const ITEM_STATS={power:'attack power',armor:'damage reduction',vitality:'maximum health'};
const itemStats=item=>Object.entries(ITEM_STATS).filter(([stat])=>item[stat]!==undefined).map(([stat,label])=>`<div>${stat==='armor'?'':'+'}${item[stat]} ${label}</div>`).join('');

class Windows {
  constructor(){this.items=new Map();this.order=20;window.addEventListener('resize',()=>{for(const w of this.items.values())this.clamp(w);});}
  get(id){return this.items.get(id);}
  open(id,title,{width=360,left=22,top=165,right,bottom,paper=false}={}){
    let w=this.get(id);if(w){this.focus(w);return w;}
    width=Math.min(width,innerWidth-16);
    if(right===undefined&&bottom===undefined){
      const occupied=[...this.items.values()].map(w=>w.el.getBoundingClientRect());
      const candidate=[left,...occupied.map(r=>r.right+12),12].find(x=>x>=8&&x+width<=innerWidth-8&&occupied.every(r=>x+width<=r.left-8||x>=r.right+8));
      if(candidate!==undefined)left=candidate;
      else if(occupied.length)top+=28*Math.min(occupied.length,3);
    }
    const el=document.createElement('section');el.className=`game-window${paper?' parchment':''}`;el.id=`window-${id}`;el.dataset.window=id;el.setAttribute('role','dialog');el.setAttribute('aria-label',title);
    el.innerHTML='<header class="window-titlebar"><span class="window-medallion"></span><strong></strong><button class="window-close" aria-label="Close">×</button></header><div class="window-content"></div>';
    el.querySelector('strong').textContent=title;el.style.width=`${Math.min(width,innerWidth-16)}px`;
    el.style.left=`${right!==undefined?innerWidth-right-width:left}px`;el.style.top=`${top}px`;
    el.style.maxHeight=`calc(100vh - ${(bottom!==undefined?bottom+55:top+115)}px)`;
    if(bottom!==undefined){el.style.top='auto';el.style.bottom=`${bottom}px`;}
    w={id,el,body:el.querySelector('.window-content'),title:el.querySelector('strong'),close:()=>this.close(id)};this.items.set(id,w);$('#windows').append(el);this.focus(w);
    el.querySelector('.window-close').onclick=w.close;el.onpointerdown=()=>this.focus(w);
    const header=el.querySelector('header');let drag=null;
    header.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const r=el.getBoundingClientRect();drag={x:e.clientX-r.left,y:e.clientY-r.top};header.setPointerCapture(e.pointerId);e.preventDefault();};
    header.onpointermove=e=>{if(!drag)return;el.style.bottom='auto';el.style.left=`${e.clientX-drag.x}px`;el.style.top=`${e.clientY-drag.y}px`;this.clamp(w);};
    header.onpointerup=header.onpointercancel=()=>{drag=null;};
    return w;
  }
  focus(w){w.el.style.zIndex=String(++this.order);}
  clamp(w){if(w.id==='map')w.el.style.width=`${atlasWindowWidth()}px`;const r=w.el.getBoundingClientRect();w.el.style.left=`${Math.max(8,Math.min(innerWidth-r.width-8,r.left))}px`;if(w.el.style.bottom==='auto'||!w.el.style.bottom){const top=Math.max(48,Math.min(innerHeight-(w.id==='map'?r.height+10:220),r.top));w.el.style.top=`${top}px`;w.el.style.maxHeight=`calc(100vh - ${top+(w.id==='map'?25:115)}px)`;}}
  close(id){const w=this.get(id);if(w){w.el.remove();this.items.delete(id);w.onClose?.();$('#game-tooltip').classList.add('hidden');$('#map-marker-tooltip').classList.add('hidden');}}
  closeAll(){for(const id of [...this.items.keys()])this.close(id);}
  closeTop(){const top=[...this.items.values()].sort((a,b)=>Number(b.el.style.zIndex)-Number(a.el.style.zIndex))[0];if(!top)return false;this.close(top.id);return true;}
}

export class GameUI {
  constructor({send,getState,getCooldownState,toast,drawMap}){
    applyRarityTheme();
    Object.assign(this,{send,getState,getCooldownState,toast,drawMap});this.windows=new Windows();this.bar=[...DEFAULT_BAR];this.locked=true;this.autoLoot=false;this.characterId=null;this.previousLevel=null;this.signature='';this.dialogueNPC=null;this.dialogueQuest=null;this.journalQuest=null;this.spellTab='class';this.journalFilter='active';this.loot=null;
    try{this.autoLoot=localStorage.getItem(storageKey('auto-loot'))==='true';}catch{}
    this.emoteAudience='auto';try{if(localStorage.getItem(storageKey('emote-audience'))==='nearby')this.emoteAudience='nearby';}catch{}this.actionKeys=[...KEYS];this.bagOrder=[];this.bagView='all';this.combineBags=false;try{this.combineBags=localStorage.getItem(storageKey('combine-bags'))==='true';}catch{}this.bankClosedFor=null;this.bindDragging();this.bindTooltips();this.renderBar();
    if(TRAVEL_NODES.length||WAYPOINTS.some(v=>v.available&&v.selfService)){const button=document.createElement('button');button.id='travel-button';button.className='game-button secondary';button.textContent='Travel';button.setAttribute('aria-label','Travel and return hearths');$('#main-menu-button').before(button);button.onclick=()=>{if(this.windows.get('travel'))this.windows.close('travel');else this.openTravel();};}
    $('#bag-button').onclick=()=>this.toggleBags();$('#character-button').onclick=()=>this.toggleCharacter();$('#spellbook-button').onclick=()=>this.toggleSpellbook();$('#journal-button').onclick=()=>this.toggleJournal();$('#quest-menu-button').onclick=()=>this.toggleJournal();
    $('#map-button').onclick=$('#map-menu-button').onclick=$('#minimap').onclick=()=>this.toggleMap();$('#help-button').onclick=()=>this.toggleHelp();
    $('#bar-lock').onclick=()=>{this.locked=!this.locked;$('#bar-lock').textContent=this.locked?'▣':'▢';$('#bar-lock').title=this.locked?'Action bar locked. Shift-drag to rearrange.':'Action bar unlocked. Drag spells to rearrange.';this.renderBar();};
  }
  get p(){return this.getState()?.self;}
  setMoving(moving){$('#windows').classList.toggle('player-moving',moving);}
  loadCharacter(id){this.abandonQuestId=null;this.bookSearch='';this.bookPages={};this.characterId=id;this.previousLevel=null;this.signature='';this.loadedBar=false;this.bagOrder=[];try{const saved=JSON.parse(localStorage.getItem(storageKey(`bar-${id}`)));if(Array.isArray(saved)&&saved.length===12&&saved.every(validAction)){this.bar=saved;this.loadedBar=true;}const bags=JSON.parse(localStorage.getItem(storageKey(`bags-${id}`)));if(Array.isArray(bags)&&bags.length<=100&&bags.every(v=>v===null||typeof v==='string'))this.bagOrder=bags;}catch{}if(!this.loadedBar)this.bar=[...DEFAULT_BAR];}
  saveBar(){try{localStorage.setItem(storageKey(`bar-${this.characterId}`),JSON.stringify(this.bar));}catch{}this.renderBar();}
  cast(id){if(actionEmote(id)){this.send({type:'emote',id:actionEmote(id),audience:this.emoteAudience});return;}if(id==='auto')this.send({type:'auto'});else if(ITEMS[id]?.consumable)this.send({type:'potion',item:id});else if(SKILLS[id])this.send({type:'skill',skill:id});}
  flashAction(id){document.querySelectorAll(`.action-slot[data-action-id="${id}"]`).forEach(b=>{b.classList.add('pressed');setTimeout(()=>b.classList.remove('pressed'),140);});}
  updateCast(cast,progress,now){
    const bar=$('#cast-bar');bar.classList.toggle('hidden',!cast);$('#interaction').classList.toggle('casting-hidden',!!cast);if(!cast)return;
    const s=SKILLS[cast.skill];$('#cast-name').textContent=cast.name||s?.name||'Casting';$('#cast-progress').style.transform=`scaleX(${progress})`;
    const remaining=Math.max(0,cast.duration-(now-cast.started)/1000).toFixed(1);if($('#cast-time').textContent!==remaining)$('#cast-time').textContent=remaining;
    const value=String(Math.round(progress*100));if(bar.getAttribute('aria-valuenow')!==value)bar.setAttribute('aria-valuenow',value);
  }
  activateSlot(index){if(index>=0&&index<12)this.cast(this.bar[index]);}
  setActionKeys(labels){this.actionKeys=labels;this.renderBar();}
  setAutoLoot(value){this.autoLoot=!!value;try{localStorage.setItem(storageKey('auto-loot'),String(this.autoLoot));}catch{}if(this.windows.get('loot'))this.renderLoot();}
  resetSession(){this.cancelDrag?.();this.windows.closeAll();this.characterId=null;this.previousLevel=null;this.signature='';this.tooltipAnchor=null;this.dialogueNPC=null;this.dialogueQuest=null;this.loot=null;}

  interact(id,shift=false){this.send({type:'interact',id,autoLoot:this.autoLoot!==shift});}
  openReading(reading){
    this.reading=reading;this.readingPage=0;
    this.windows.open('reading',reading.title,{width:480,left:38,top:100,paper:true});this.renderReading();
  }
  renderReading(){
    const w=this.windows.get('reading'),r=this.reading;if(!w||!r)return;
    const page=r.pages[this.readingPage];w.title.textContent=r.title;w.el.setAttribute('aria-label',r.title);
    w.body.innerHTML=`<article class="world-reading"><p class="reading-author">${esc(r.author)}</p><h2>${esc(page.heading)}</h2>${page.text.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}</article><nav class="reading-pages" aria-label="Document pages"><button class="game-button secondary" data-reading-prev ${this.readingPage===0?'disabled':''}>‹ Previous</button><span>Page ${this.readingPage+1} / ${r.pages.length}</span><button class="game-button secondary" data-reading-next ${this.readingPage===r.pages.length-1?'disabled':''}>Next ›</button></nav>`;
    w.body.querySelector('[data-reading-prev]').onclick=()=>{this.readingPage=Math.max(0,this.readingPage-1);this.renderReading();};
    w.body.querySelector('[data-reading-next]').onclick=()=>{this.readingPage=Math.min(r.pages.length-1,this.readingPage+1);this.renderReading();};
    w.body.scrollTop=0;
  }
  update(){
    if(!this.p)return;const p=this.p;
    if(this.currentMapId!==p.mapId){if(this.atlasId===this.currentMapId)this.atlasId=p.mapId;this.currentMapId=p.mapId;}
    if(this.previousLevel===null){if(!this.loadedBar)this.bar=[null,null,null,null,'potion','auto',null,null,null,null,null,null];this.bar=this.bar.map(id=>SKILLS[id]&&id!=='recall'&&!classSkills(p).includes(id)?null:id);if(!this.loadedBar)for(const id of classSkills(p)){const s=SKILLS[id];if(p.level>=s.level&&Number(s.key)>=1&&Number(s.key)<=12)this.bar[Number(s.key)-1]=id;}if(!this.loadedBar)this.bar[11]='recall';this.renderBar();}
    else if(p.level>this.previousLevel){for(const[id,s]of classSkills(p).map(id=>[id,SKILLS[id]]))if(this.previousLevel<s.level&&p.level>=s.level&&!this.bar.includes(id)){const index=this.bar[Number(s.key)-1]===null?Number(s.key)-1:this.bar.indexOf(null);if(index>=0)this.bar[index]=id;}this.saveBar();}
    this.previousLevel=p.level;this.updateBar();
    if(p.bank){if(!this.windows.get('bank')&&this.bankClosedFor!==p.bank.npcId)this.openBank();}else{this.windows.close('bank');this.bankClosedFor=null;}
    const signature=JSON.stringify([p.mapId,p.inventory,p.equipment,p.bags,p.gold,p.quests,p.trackedQuest,p.level,p.bank,p.emotes,p.reputation,p.waypointId]);
    if(signature!==this.signature){this.signature=signature;this.renderBagDock();for(const id of ['bags','character','spellbook','journal','merchant','bank'])if(this.windows.get(id))this[`render${id[0].toUpperCase()+id.slice(1)}`]();if(this.windows.get('dialogue'))this.renderDialogue();if(this.windows.get('map'))this.showAtlas(this.atlasId);}
    $('#bag-space').textContent=String(Math.max(0,inventoryCapacity(p)-bagEntries(p).length));
    for(const id of ['dialogue','merchant'])if(this.windows.get(id)){const npc=this.getState()?.npcs?.find(n=>n.id===(id==='merchant'?(this.merchantNPC||'tavi'):this.dialogueNPC));if(!npc||p.hp<=0||distance(p,npc)>6)this.windows.close(id);}
    if(this.windows.get('loot')){const corpse=this.getState().enemies.find(e=>e.id===this.loot?.id);if(!corpse||!corpse.lootable||distance(p,corpse)>4.8||p.hp<=0)this.windows.close('loot');}
    if(this.windows.get('travel'))this.renderTravel();
    this.refreshTooltip();
  }
  openTravel(destination){if(!this.windows.get('travel'))this.windows.open('travel','Travel & return hearths',{width:Math.min(1120,innerWidth-32),left:Math.max(16,(innerWidth-1120)/2),top:55});this.renderTravel();if(destination)this.flightMap?.select(destination,true);}
  renderTravel(){renderFlightMap(this);}
  renderBar(){
    const root=$('#action-slots');root.innerHTML=this.bar.map((id,i)=>`<button class="action-slot${id?'':' empty'}" data-slot="${i}" ${id?`data-action-id="${id}" draggable="true"`:''} aria-label="${id?EMOTES[actionEmote(id)]?.name||SKILLS[id]?.name|| (id==='auto'?'Auto Attack':(ITEMS[id]?.name||'Healing tonic')):'Empty action slot'} (${this.actionKeys[i]})"><kbd>${this.actionKeys[i]}</kbd>${id?icon(id):''}<i class="cooldown-sweep"></i><span class="cooldown-number"></span><span class="slot-count"></span></button>`).join('');
    root.querySelectorAll('[data-slot]').forEach(b=>{
      const index=Number(b.dataset.slot);b.onclick=()=>this.cast(this.bar[index]);b.oncontextmenu=e=>{e.preventDefault();if(!this.locked){this.bar[index]=null;this.saveBar();}};
      this.enableDrag(b,()=>this.bar[index]?{action:this.bar[index],slot:index}:null,e=>!this.locked||e.shiftKey);
    });
    this.updateBar();
  }
  enableDrag(el,payload,allowed=()=>true){
    el.draggable=false;el.ondragstart=e=>e.preventDefault();
    el.onpointerdown=e=>{if(e.button===2){e.preventDefault();return;}if(e.button!==0||!allowed(e))return;const value=payload();if(!value)return;this.pointerDrag={...value,el,startX:e.clientX,startY:e.clientY,pointerId:e.pointerId,active:false};el.setPointerCapture(e.pointerId);};
  }
  bindDragging(){
    document.addEventListener('pointerdown',()=>{this.suppressClickUntil=0;},true);
    const clear=()=>{const drag=this.pointerDrag;this.pointerDrag=null;$('#action-drag-ghost')?.remove();document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));if(drag?.el.hasPointerCapture(drag.pointerId))drag.el.releasePointerCapture(drag.pointerId);};
    this.cancelDrag=clear;
    document.addEventListener('pointermove',e=>{
      const d=this.pointerDrag;if(!d)return;if(!d.active&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<6)return;d.active=true;e.preventDefault();
      let ghost=$('#action-drag-ghost');if(!ghost){ghost=document.createElement('div');ghost.id='action-drag-ghost';ghost.innerHTML=icon(d.action||d.item);document.body.append(ghost);}ghost.style.left=`${e.clientX+10}px`;ghost.style.top=`${e.clientY+10}px`;$('#game-tooltip').classList.add('hidden');
      document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot],[data-equipment],[data-bag-slot],[data-bag-equip],[data-bank-deposit]')?.classList.add('drop-target');
    },{passive:false});
    document.addEventListener('pointerup',e=>{
      const d=this.pointerDrag;if(!d)return;
      if(d.active){
        this.suppressClickUntil=performance.now()+250;const target=document.elementFromPoint(e.clientX,e.clientY),slot=target?.closest('[data-slot]'),equipment=target?.closest('[data-equipment]'),bagEquip=target?.closest('[data-bag-equip]'),bag=target?.closest('[data-bag-slot]');
        if(d.bankItem){if(bag)this.send({type:'bank',action:'withdraw',item:d.bankItem,count:d.count||1});}
        else if(target?.closest('[data-bank-deposit]')&&d.item)this.send({type:'bank',action:'deposit',item:d.item,count:d.count||1});
        else if(slot&&d.action&&validAction(d.action)&&(SKILLS[d.action]?.level||1)<=this.p.level&&(!actionEmote(d.action)||knowsEmote(this.p,actionEmote(d.action)))){const index=Number(slot.dataset.slot);if(Number.isInteger(d.slot))[this.bar[index],this.bar[d.slot]]=[d.action,this.bar[index]];else this.bar[index]=d.action;this.saveBar();}
        else if(bagEquip&&ITEMS[d.item]?.bagSlots)this.send({type:'equipBag',item:d.item,index:Number(bagEquip.dataset.bagEquip)});
        else if(equipment&&d.item&&canEquipInSlot(d.item,equipment.dataset.equipment))this.send({type:'equip',item:d.item,slot:equipment.dataset.equipment});
        else if(bag&&d.bagKey){const from=this.bagOrder.indexOf(d.bagKey),to=Number(bag.dataset.bagSlot);if(from>=0){[this.bagOrder[from],this.bagOrder[to]]=[this.bagOrder[to],this.bagOrder[from]];try{localStorage.setItem(storageKey(`bags-${this.characterId}`),JSON.stringify(this.bagOrder));}catch{}this.renderBags();}}
        else if(Number.isInteger(d.slot)){this.bar[d.slot]=null;this.saveBar();}
      }
      clear();
    },true);
    document.addEventListener('click',e=>{if(performance.now()<(this.suppressClickUntil||0)){e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);
  }
  addToBar(id){const index=this.bar.indexOf(null);if(index<0)return this.toast('Your action bar is full. Drag onto a slot to replace it.');this.bar[index]=id;this.saveBar();this.toast(`${EMOTES[actionEmote(id)]?.name||SKILLS[id]?.name||'Auto Attack'} added to slot ${this.actionKeys[index]}.`,'good');}
  updateBar(){
    if(!this.p)return;const p=this.p,snapshot=this.getState(),timing=this.getCooldownState?.()||{time:snapshot.time,globalRemaining:Math.max(0,(p.globalCooldown?.endsAt||0)-snapshot.time)},target=snapshot.enemies.find(e=>e.id===p.target),friendly=snapshot.players.find(e=>e.id===p.target)||(snapshot.npcs||[]).find(e=>e.id===p.target);
    $('#action-slots').querySelectorAll('[data-slot]').forEach(b=>{
      const id=this.bar[Number(b.dataset.slot)],s=SKILLS[id],ownDuration=ITEMS[id]?.consumable?8:s?.cooldown||0,ownRemaining=Math.min(ownDuration,Math.max(0,(p.cooldowns[ITEMS[id]?.consumable?'potion':id]||0)-timing.time)),globalRemaining=s&&s.triggersGCD!==false&&p.level>=s.level?timing.globalRemaining:0;
      const shared=globalRemaining>ownRemaining,remain=shared?globalRemaining:ownRemaining,duration=shared?GLOBAL_COOLDOWN:ownDuration;
      b.classList.toggle('active',id==='auto'&&p.auto);b.classList.toggle('unlearned',!!s&&p.level<s.level);b.classList.toggle('no-energy',!!s&&p.energy<s.cost);b.classList.toggle('global-cooldown',shared);
      const kind=remain>0?(shared?'global':'ability'):'';if(b.dataset.cooldownKind!==kind)b.dataset.cooldownKind=kind;
      b.classList.toggle('out-of-range',!!s&&!s.travel&&(s.selfOnly||s.partyHeal?false:s.heal||s.friendlyTarget?!!friendly&&distance(p,friendly)>s.range:!s.area&&!s.shield&&!!target&&target.hp>0&&distance(p,target)>s.range));
      const sweep=b.querySelector('.cooldown-sweep');sweep.classList.toggle('hidden',!remain);if(remain)sweep.style.setProperty('--remaining',`${Math.min(1,remain/duration)*360}deg`);
      // Short shared sweeps stay uncluttered; longer ability timers keep their
      // normal countdown and take precedence whenever they lock the slot longer.
      const number=b.querySelector('.cooldown-number'),text=remain>0&&!shared?(remain>=60?`${Math.ceil(remain/60)}m`:remain>=1?String(Math.ceil(remain)):remain.toFixed(1)):'';if(number.textContent!==text)number.textContent=text;
      const count=b.querySelector('.slot-count'),countText=ITEMS[id]?.consumable?String(p.inventory[id]||0):'';if(count.textContent!==countText)count.textContent=countText;
    });
  }
  toggleBags(){if(this.windows.get('bags'))return this.windows.close('bags');this.bagView='all';this.openBagWindow();}
  openBagWindow(){this.windows.open('bags','Backpack & bags',{width:264,right:20,bottom:innerWidth<=1280?175:145});this.renderBags();}
  openBag(index){this.bagView=!this.combineBags&&this.p.bags?.[index]?`bag${index}`:'all';this.openBagWindow();}
  renderBagDock(){
    const root=$('#extra-bag-slots');if(!root||!this.p)return;
    root.innerHTML=Array.from({length:BAG_EQUIP_SLOTS},(_,index)=>{const id=this.p.bags?.[index];return `<button class="bag-equip-button ${id?'occupied':'empty'}" data-bag-equip="${index}" ${id?`data-item="${id}"`:''} aria-label="Bag slot ${index+1}: ${ITEMS[id]?.name||'Empty'}" title="${ITEMS[id]?.name||'Empty bag slot · Drag a bag here'}">${icon('bag')}${id?`<span>${ITEMS[id].bagSlots}</span>`:'<span>+</span>'}</button>`;}).join('');
    this.bindBagEquip(root);
  }
  bindBagEquip(root){root.querySelectorAll('[data-bag-equip]').forEach(b=>{const index=Number(b.dataset.bagEquip);b.onclick=()=>this.openBag(index);b.oncontextmenu=e=>e.preventDefault();b.onpointerup=e=>{if(e.button===2){e.preventDefault();this.send({type:'unequipBag',index});}};});}

  orderedBags(){
    const counts={},entries=bagEntries(this.p).map(entry=>({...entry,key:`${entry.id}:${counts[entry.id]=(counts[entry.id]||0)+1}`})),remaining=new Map(entries.map(v=>[v.key,v]));
    const slots=Array.from({length:Math.max(inventoryCapacity(this.p),entries.length)},(_,i)=>{const key=this.bagOrder[i],entry=remaining.get(key);if(entry)remaining.delete(key);return entry||null;});
    for(const entry of remaining.values())slots[slots.indexOf(null)]=entry;
    this.bagOrder=slots.map(v=>v?.key||null);return slots;
  }
  renderBags(){
    const w=this.windows.get('bags');if(!w||!this.p)return;
    const entries=this.orderedBags(),used=entries.filter(Boolean).length,capacity=inventoryCapacity(this.p),containers=bagContainers(this.p);
    if(this.bagView!=='all'&&!containers.some(c=>c.key===this.bagView&&c.capacity))this.bagView='all';
    const visible=this.combineBags?[{key:'combined',name:'Combined bag',capacity,start:0}]:containers.filter(c=>c.capacity&&(this.bagView==='all'||c.key===this.bagView));
    if(entries.length>capacity)visible.push({name:'Overflow · make room or equip a bag',capacity:entries.length-capacity,start:capacity});
    w.body.innerHTML=`<div class="equipped-bags"><button data-bag-view="all" class="bag-view-all ${this.bagView==='all'?'selected':''}">All</button><button data-bag-view="backpack" title="Backpack · 20 slots" class="bag-container-tab">${icon('bag')}</button>${containers.slice(1).map(c=>`<button class="bag-container-tab ${c.item?'occupied':'empty'}" data-bag-equip="${c.index}" ${c.item?`data-item="${c.item}"`:''} title="${c.name}${c.capacity?` · ${c.capacity} slots`:''}">${icon('bag')}<span>${c.capacity||'+'}</span></button>`).join('')}</div><label class="bag-combine-option"><input id="combine-bags" type="checkbox" ${this.combineBags?'checked':''}> Combine bags into one</label><div class="bag-caption"><span>${used} / ${capacity} slots used</span><span>${Math.max(0,capacity-used)} free</span></div>${visible.map(container=>`<section class="bag-section"><h4>${container.name}<small>${container.capacity} slots</small></h4><div class="bag-grid">${entries.slice(container.start,container.start+container.capacity).map((entry,local)=>{const i=container.start+local,item=ITEMS[entry?.id];return `<button class="bag-slot ${item?.quality||'empty'}" data-bag-slot="${i}" ${entry?`data-item="${entry.id}" data-stack-count="${entry.count}" aria-label="${item.name} ×${entry.count}"`:'aria-label="Empty bag slot"'}>${entry?`${icon(entry.id)}${entry.count>1?`<span class="stack-count">${entry.count}</span>`:''}${item.quest?'<b class="quest-item-mark">!</b>':''}`:''}</button>`;}).join('')}</div></section>`).join('')}${entries.length>capacity?'<p class="window-footnote">Some items need space. Equip a larger bag.</p>':''}<div class="bag-money">${money(this.p.gold)}</div><p class="window-footnote">${this.correspondence?.tab==='compose'&&this.windows.get('mail')?'Right-click to attach to your letter; Shift-right-click for a stack.':this.p.bank?'Right-click to deposit; Shift-right-click for a stack.':this.windows.get('merchant')?'Right-click to sell; Shift-right-click for a stack.':'Right-click to equip or use.'} Drag to arrange.<br>Drag bags onto one of the four bag slots.<br>Right-click an equipped bag to remove it.</p>`;
    w.body.querySelectorAll('[data-bag-view]').forEach(b=>b.onclick=()=>{this.bagView=this.combineBags?'all':b.dataset.bagView;this.renderBags();});this.bindBagEquip(w.body);
    w.body.querySelector('#combine-bags').onchange=e=>{this.combineBags=e.target.checked;this.bagView='all';try{localStorage.setItem(storageKey('combine-bags'),String(this.combineBags));}catch{}this.renderBags();};
    w.body.querySelectorAll('.bag-slot[data-item]').forEach(b=>{const item=ITEMS[b.dataset.item];if(!item.quest){if(this.correspondence?.tab==='compose'&&this.windows.get('mail'))b.dataset.transaction='attach';else if(this.p.bank&&this.windows.get('bank'))b.dataset.transaction='deposit';else if(this.windows.get('merchant')&&item.sell)b.dataset.transaction='sell';}b.oncontextmenu=e=>e.preventDefault();b.onpointerup=e=>{if(e.button===2){e.preventDefault();this.useBagItem(b.dataset.item,e.shiftKey,Number(b.dataset.stackCount));}};b.ondblclick=()=>this.useBagItem(b.dataset.item);this.enableDrag(b,()=>({item:b.dataset.item,bagKey:this.bagOrder[Number(b.dataset.bagSlot)],count:Number(b.dataset.stackCount),...(ITEMS[b.dataset.item]?.consumable?{action:b.dataset.item}:{})}));});
  }

  openBank(){
    if(!this.p?.bank)return;this.windows.close('merchant');this.windows.close('dialogue');this.bagView='all';this.openBagWindow();
    const w=this.windows.open('bank','Personal bank',{width:280,left:Math.max(20,innerWidth-600),top:90});
    w.onClose=()=>{this.bankClosedFor=this.p?.bank?.npcId;this.send({type:'bank',action:'close'});this.renderBags();};this.renderBank();this.renderBags();
  }
  renderBank(){
    const w=this.windows.get('bank'),bank=this.p?.bank;if(!w||!bank)return;
    const entries=bankEntries({bank:bank.inventory});w.body.dataset.bankDeposit='';
    w.body.innerHTML=`<p class="bank-contact">${esc(bank.name)} · Personal storage</p><div class="bag-caption"><span>${entries.length} / ${bank.capacity} slots used</span><span>${Math.max(0,bank.capacity-entries.length)} free</span></div><div class="bag-grid bank-grid">${Array.from({length:Math.max(bank.capacity,entries.length)},(_,i)=>{const entry=entries[i],item=ITEMS[entry?.id];return `<button class="bag-slot ${item?.quality||'empty'}" data-bank-slot="${i}" ${entry?`data-item="${entry.id}" data-stack-count="${entry.count}" aria-label="${esc(item.name)} ×${entry.count}"`:'aria-label="Empty bank slot"'}>${entry?`${icon(entry.id)}${entry.count>1?`<span class="stack-count">${entry.count}</span>`:''}`:''}</button>`;}).join('')}</div><p class="window-footnote">Right-click a bag item to deposit or a bank item to withdraw.<br>Shift-right-click transfers its stack. Drag between storage windows to transfer a stack.<br>Equipped gear, equipped bags and quest items stay with you.<br>Walk away from the banker to close your bank.</p>`;
    w.body.querySelectorAll('[data-bank-slot][data-item]').forEach(b=>{b.dataset.transaction='withdraw';const withdraw=(all=false)=>this.send({type:'bank',action:'withdraw',item:b.dataset.item,count:all?Number(b.dataset.stackCount):1});b.oncontextmenu=e=>e.preventDefault();b.onpointerup=e=>{if(e.button===2){e.preventDefault();withdraw(e.shiftKey);}};b.ondblclick=()=>withdraw();this.enableDrag(b,()=>({item:b.dataset.item,bankItem:b.dataset.item,count:Number(b.dataset.stackCount)}));});
  }

  useBagItem(id,all=false,count=1){if(this.correspondence?.attach(id,all?count:1))return;if(this.p.bank&&this.windows.get('bank'))return this.send({type:'bank',action:'deposit',item:id,count:all?count:1});if(this.windows.get('merchant')){if(ITEMS[id].sell)this.send({type:'trade',action:'sellItem',item:id,all,count});else this.toast('This item cannot be sold.');}else if(ITEMS[id].bagSlots)this.send({type:'equipBag',item:id});else if(ITEMS[id].slot)this.send({type:'equip',item:id});else if(ITEMS[id]?.consumable)this.send({type:'potion',item:id});}
  toggleCharacter(){if(this.windows.get('character'))return this.windows.close('character');this.windows.open('character','Character',{width:520,left:25,top:75});this.renderCharacter();}
  renderCharacter(){
    const w=this.windows.get('character');if(!w||!this.p)return;if(this.characterTab==='reputation')return renderReputation(this,w);const p=this.p,count=EQUIPMENT_SLOTS.filter(slot=>p.equipment[slot.id]).length;
    const slotRow=slot=>{const id=p.equipment[slot.id],item=ITEMS[id];return `<div class="gear-row ${slot.side}"><button class="equipment-slot ${item?.quality||'empty'}" data-equipment="${slot.id}" ${id?`data-item="${id}"`:''} aria-label="${slot.name}: ${item?.name||'Empty'}">${icon(id||slot.icon)}</button><span><b>${slot.name}</b><small class="quality-${item?.quality||'empty'}">${item?.name||(slot.later?'Later adventures':'Empty')}</small></span></div>`;};
    w.body.innerHTML=`<div class="character-name">${esc(p.name)}<small>Level ${p.level} ${classDefinition(p.classId).name} <span>${count} / ${EQUIPMENT_SLOTS.length} equipped</span></small></div><div class="equipment-paperdoll"><div class="gear-column">${EQUIPMENT_SLOTS.filter(slot=>slot.side==='left').map(slotRow).join('')}</div><div class="gear-center"><div class="gear-figure"><svg viewBox="0 0 80 160" aria-hidden="true"><use href="/icons.svg#paperdoll"/></svg></div><dl class="character-stats"><dt>Health</dt><dd>${p.maxHp}</dd><dt>${classDefinition(p.classId).resource}</dt><dd>100</dd><dt>Power</dt><dd>${p.power}</dd><dt>Armor</dt><dd>${p.armor}</dd></dl><p>Your journey<br>is just beginning.</p></div><div class="gear-column">${EQUIPMENT_SLOTS.filter(slot=>slot.side==='right').map(slotRow).join('')}</div></div><div class="gear-weapons">${EQUIPMENT_SLOTS.filter(slot=>slot.side==='bottom').map(slotRow).join('')}</div><p class="window-footnote gear-help">Right-click to unequip. Drag compatible gear onto a slot.<br>More equipment will appear as the world grows.</p>`;
    characterTabs(this,w);
    w.body.querySelectorAll('[data-equipment]').forEach(b=>{b.oncontextmenu=e=>e.preventDefault();b.onpointerup=e=>{if(e.button===2){e.preventDefault();this.send({type:'unequip',slot:b.dataset.equipment});}};});
  }
  openDialogue(npc){this.dialogueNPC=npc;this.dialogueQuest=null;this.windows.open('dialogue',NPCS.find(n=>n.id===npc).name,{width:356,left:22,top:166,paper:true});this.renderDialogue();}
  rewards(q){q=questForPlayer(this.p,q);const item=ITEMS[q.reward];return `<h4>Rewards</h4><div class="quest-rewards">${item?`<div class="reward-item" data-item="${q.reward}"><span class="reward-icon ${item.quality}">${icon(q.reward)}</span><span class="quality-${item.quality}">${item.name}${q.rewardCount>1?` ×${q.rewardCount}`:''}</span></div>`:''}<div>You will receive: ${money(q.gold)}</div><div>Experience: <b>${q.xp}</b></div>${q.emoteReward?`<div class="social-quest-reward">${emoteIcon(q.emoteReward)} Learn <b>/${q.emoteReward}</b> · ${EMOTES[q.emoteReward].name}</div>`:""}${q.reputationReward?`<div>+${q.reputationReward} reputation</div>`:""}</div>`;}
  renderDialogue(){
    const w=this.windows.get('dialogue'),p=this.p;if(!w||!p)return;const npc=NPCS.find(n=>n.id===this.dialogueNPC);w.title.textContent=npc.name;
    const raw=QUESTS.find(q=>q.id===this.dialogueQuest),q=raw&&questForPlayer(p,raw);
    if(q){
      const record=questRecord(p,q),ready=questReady(p,q)&&q.turnIn===npc.id,available=questAvailable(p,q)&&q.giver===npc.id;
      w.body.innerHTML=`<button class="gossip-back">‹ ${npc.name}</button><h2 class="quest-title">${q.title}</h2><p>${ready?q.complete:q.text}</p><h4>Quest Objectives</h4><p class="quest-objectives">${q.objective}${record?` <b>${record.progress}/${q.count}</b>`:` (${q.count})`}</p>${this.rewards(q)}<div class="window-buttons">${available||ready?`<button class="game-button" data-quest="${q.id}" data-action="${ready?'complete':'accept'}">${ready?'Complete Quest':'Accept'}</button>`:''}<button class="game-button secondary" data-decline>${available?'Decline':'Back'}</button></div>`;
      w.body.querySelector('.gossip-back').onclick=w.body.querySelector('[data-decline]').onclick=()=>{this.dialogueQuest=null;this.renderDialogue();};
      const action=w.body.querySelector('[data-quest]');if(action)action.onclick=()=>{this.send({type:'quest',id:q.id,action:ready?'complete':'accept'});this.dialogueQuest=null;};return;
    }
    const quests=dialogueQuests(p,npc.id),topics=capitalTopics(npc,p),greeting=STORY_GREETINGS[npc.id];
    w.body.innerHTML=`<div class="npc-introduction"><span class="npc-seal">${icon(npc.role==='merchant'?'bag':npc.services?.includes('trainer')?'sword':'scroll')}</span><span>${npc.title}</span></div>${npc.lore?`<p class="npc-lore">${npc.lore}</p>`:''}<p>${esc(LIVE_DIALOGUE[npc.id]?.greeting??(greeting&&questDone(p,greeting.quest)?greeting.text:npcGreeting(p,npc)))}</p><div class="gossip-options">${topics.map(t=>`<button class="gossip-option" data-npc-topic="${t.id}"><span class="gossip-mark">❖</span>${esc(t.label)}</button>`).join('')}${quests.map(q=>`<button data-quest-offer="${q.id}" class="gossip-option"><span class="gossip-mark">${questReady(p,q)?'?':questAvailable(p,q)?'!':'·'}</span>${q.title}${questRecord(p,q)?.status==='active'&&!questReady(p,q)?'<small>In progress</small>':''}</button>`).join('')}${npc.role==='merchant'?'<button class="gossip-option" data-shop><span class="gossip-mark">▣</span>Let me browse your goods.</button>':''}${npc.services?.includes('waypoint')?`<button class="gossip-option" data-bind-waypoint><span class="gossip-mark">⌂</span>${p.waypointId===WAYPOINTS.find(v=>v.npcId===npc.id)?.id?'Your return waypoint is set here.':'Set my return waypoint at this inn.'}</button>`:''}${npc.role==='healer'?'<p class="npc-note">The hearth has restored your health and energy.</p>':''}</div><div class="window-buttons"><button class="game-button secondary" data-goodbye>Goodbye</button></div>`;
    w.body.querySelectorAll('[data-npc-topic]').forEach(b=>b.onclick=()=>this.send({type:'npcTopic',npc:npc.id,topic:b.dataset.npcTopic}));
    w.body.querySelectorAll('[data-quest-offer]').forEach(b=>b.onclick=()=>{this.dialogueQuest=b.dataset.questOffer;this.renderDialogue();});w.body.querySelector('[data-goodbye]').onclick=w.close;
    const bind=w.body.querySelector('[data-bind-waypoint]');if(bind)bind.onclick=()=>this.send({type:'waypoint',npcId:npc.id});
    if(w.body.querySelector('[data-shop]'))w.body.querySelector('[data-shop]').onclick=()=>this.openMerchant();
  }
  questComplete(){this.dialogueQuest=null;if(this.windows.get('dialogue'))this.renderDialogue();}
  openMerchant(){this.windows.close('bank');this.windows.close('dialogue');this.merchantNPC=this.dialogueNPC||'tavi';const shop=this.windows.open('merchant',`${NPCS.find(n=>n.id===this.merchantNPC)?.name||'Town'} · provisions`,{width:332,left:24,top:165});if(!this.windows.get('bags'))this.toggleBags();shop.onClose=()=>this.renderBags();this.renderBags();this.renderMerchant();}
  renderMerchant(){const w=this.windows.get('merchant');if(!w||!this.p)return;w.body.innerHTML=`<p class="vendor-greeting">“Tonics, bags, and trail gear. A fair price for what you find.”</p>${MERCHANT_STOCK.map(id=>`<button class="vendor-item" data-buy="${id}" data-item="${id}" ${this.p.level<(ITEMS[id].minLevel||1)?'disabled':''}><span class="reward-icon ${ITEMS[id].quality}">${icon(id)}</span><span><strong class="quality-${ITEMS[id].quality}">${ITEMS[id].name}</strong><small>${ITEMS[id].bagSlots?`${ITEMS[id].bagSlots}-slot bag · Requires level ${ITEMS[id].minLevel||1}`:ITEMS[id].slot?compatibleEquipmentSlots(id).map(slot=>slot.name).join(' / '):'Restores 80 health'}</small>${money(ITEMS[id].price)}</span></button>`).join('')}<p class="window-footnote">Right-click a shop item to buy one.<br>Right-click a backpack item to sell one; Shift-right-click sells the stack.<br>Close the shop to right-click and equip purchased gear.<br>Drag purchased bags onto empty bag slots to equip.</p><button class="game-button" data-sell-goods>Sell trade goods</button><div class="vendor-money">${money(this.p.gold)}</div>`;w.body.querySelectorAll('[data-buy]').forEach(b=>{b.dataset.transaction='buy';const buy=()=>this.send({type:'trade',action:'buy',item:b.dataset.buy});b.onclick=buy;b.oncontextmenu=e=>e.preventDefault();b.onpointerup=e=>{if(e.button===2){e.preventDefault();buy();}};});w.body.querySelector('[data-sell-goods]').onclick=()=>this.send({type:'trade',action:'sell'});}

  openLoot(data){this.loot=data;if(!data.coins&&!data.items.length){this.windows.close('loot');return;}this.windows.open('loot',data.name,{width:278,left:390,top:190});this.renderLoot();}
  renderLoot(){const w=this.windows.get('loot'),data=this.loot;if(!w||!data)return;w.body.innerHTML=`<div class="loot-rows">${data.coins?`<button class="loot-row" data-loot-slot="coins"><span class="loot-coin">●</span><span>${money(data.coins)}</span></button>`:''}${data.items.map(entry=>`<button class="loot-row" data-loot-slot="${entry.key}" data-item="${entry.item}"><span class="reward-icon ${ITEMS[entry.item].quality}">${icon(entry.item)}</span><span class="quality-${ITEMS[entry.item].quality}">${ITEMS[entry.item].name}${entry.count>1?` ×${entry.count}`:''}${ITEMS[entry.item].quest?'<small>Quest item</small>':''}</span></button>`).join('')}</div><button class="game-button loot-all" data-loot-all>Loot All</button><label class="auto-loot-option"><input type="checkbox" id="auto-loot-option" ${this.autoLoot?'checked':''}> Auto Loot</label><p class="window-footnote">Shift-right-click a corpse to quick loot.</p>`;w.body.querySelectorAll('[data-loot-slot]').forEach(b=>b.onclick=()=>this.send({type:'loot',id:data.id,slot:b.dataset.lootSlot}));w.body.querySelector('[data-loot-all]').onclick=()=>this.send({type:'loot',id:data.id,slot:'all'});w.body.querySelector('input').onchange=e=>this.setAutoLoot(e.target.checked);}
  toggleSpellbook(){if(this.windows.get('spellbook'))return this.windows.close('spellbook');this.windows.open('spellbook','Spellbook & Abilities',{width:568,left:35,top:75,paper:true});this.renderSpellbook();}
  renderSpellbook(){const w=this.windows.get('spellbook');if(w&&this.p)renderAbilityBook(this,w,icon);}
  toggleJournal(){if(this.windows.get('journal'))return this.windows.close('journal');this.windows.open('journal','Quest Log',{width:625,left:24,top:165,paper:true});this.renderJournal();}
  renderJournal(){
    const w=this.windows.get('journal');if(!w||!this.p)return;const p=this.p;
    const quests=QUESTS.filter(q=>this.journalFilter==='active'?questRecord(p,q)?.status==='active':this.journalFilter==='completed'?questDone(p,q):questAvailable(p,q)).map(q=>questForPlayer(p,q));
    if(!quests.some(q=>q.id===this.journalQuest))this.journalQuest=quests[0]?.id||null;
    const q=quests.find(q=>q.id===this.journalQuest),r=q?questRecord(p,q):null;
    w.body.innerHTML=`<nav class="journal-filters">${[['active','Current'],['available','Available'],['completed','Completed']].map(([id,label])=>`<button data-journal-filter="${id}" class="${this.journalFilter===id?'selected':''}">${label}</button>`).join('')}</nav><div class="journal-columns"><div class="journal-list"><div class="journal-zone">${esc(UI_CONFIG.zoneLabels?.[p.mapId]||UI_CONFIG.region||'Quests')}</div>${quests.map(q=>`<button data-journal-quest="${q.id}" class="${q.id===this.journalQuest?'selected':''}"><span>${questDone(p,q)?'✓':questReady(p,q)?'?':questAvailable(p,q)?'!':'◇'}</span>${q.title}</button>`).join('')}${!quests.length?'<p class="journal-empty">No quests in this section.</p>':''}</div><article class="journal-detail">${q?`<h2>${q.title}</h2><p>${q.text}</p><h4>Objectives</h4><p>${q.objective}${r?` · ${r.progress}/${q.count}`:''}</p><p class="quest-contact">${questDone(p,q)?'Completed':questReady(p,q)?`Return to ${NPCS.find(n=>n.id===q.turnIn).name}`:r?'In progress':`Available from ${NPCS.find(n=>n.id===q.giver).name}`}</p>${this.rewards(q)}${r?.status==='active'?`<button class="game-button" data-track-quest="${q.id}">${p.trackedQuest===q.id?'Tracking':'Track Quest'}</button>`:''}`:'<h2>Your next adventure</h2><p>Look for people with a gold exclamation mark above their heads. They have work for a traveler.</p>'}</article></div><div class="journal-status">${activeQuests(p).length}/12 active quests · ${QUESTS.filter(q=>questDone(p,q)).length}/${QUESTS.filter(q=>!q.classId||q.classId===p.classId).length} completed</div>`;
    w.body.querySelectorAll('[data-journal-filter]').forEach(b=>b.onclick=()=>{this.journalFilter=b.dataset.journalFilter;this.journalQuest=null;this.renderJournal();});
    w.body.querySelectorAll('[data-journal-quest]').forEach(b=>b.onclick=()=>{this.journalQuest=b.dataset.journalQuest;this.abandonQuestId=null;this.renderJournal();});const track=w.body.querySelector('[data-track-quest]');if(track)track.onclick=()=>this.send({type:'trackQuest',id:track.dataset.trackQuest});
    if(r?.status==='active'){
      const detail=w.body.querySelector('.journal-detail'),button=document.createElement('button');button.className='game-button secondary abandon-quest';button.dataset.abandonQuest=q.id;button.textContent='Abandon Quest';button.onclick=()=>{this.abandonQuestId=q.id;this.renderJournal();};detail.append(button);
      if(this.abandonQuestId===q.id){const confirmation=document.createElement('section');confirmation.className='quest-abandon-confirmation';confirmation.setAttribute('role','alertdialog');confirmation.setAttribute('aria-label',`Abandon ${q.title}?`);confirmation.innerHTML='<strong></strong><p>Progress and its quest items will be removed. You can accept it again from its giver.</p><button class="game-button" data-confirm-abandon>Abandon Quest</button> <button class="game-button secondary" data-cancel-abandon>Keep Quest</button>';confirmation.querySelector('strong').textContent=`Abandon “${q.title}”?`;detail.append(confirmation);confirmation.scrollIntoView({block:'nearest'});confirmation.querySelector('[data-cancel-abandon]').focus({preventScroll:true});confirmation.querySelector('[data-confirm-abandon]').onclick=e=>{e.currentTarget.disabled=true;this.abandonQuestId=null;this.send({type:'quest',action:'abandon',id:q.id});};confirmation.querySelector('[data-cancel-abandon]').onclick=()=>{this.abandonQuestId=null;this.renderJournal();};}
    }

  }

  toggleMap(){
    if(this.windows.get('map'))return this.windows.close('map');
    const width=atlasWindowWidth();
    const w=this.windows.open('map','World atlas',{width,left:Math.max(16,(innerWidth-width)/2),top:60,paper:true});
    w.el.style.maxHeight='calc(100vh - 85px)';
    w.body.innerHTML='<nav class="atlas-navigation" aria-label="Map navigation"><button id="atlas-up" aria-label="Go up one map level">↶</button><div id="atlas-breadcrumbs"></div><button id="atlas-locate">Find me</button></nav><canvas id="zone-map" width="1000" height="720" tabindex="0" role="img"></canvas><div id="atlas-regions" aria-label="Charted regions"></div><div class="atlas-footer"><span id="atlas-status" role="status"></span><span>Scroll to zoom · Drag to pan · Right-click to go up</span></div>';
    const canvas=$('#zone-map'),status=$('#atlas-status'),up=()=>{const parent=atlasMap(canvas.dataset.mapId).parent;if(parent)this.showAtlas(parent);};
    $('#atlas-up').onclick=up;$('#atlas-locate').onclick=()=>this.showAtlas(this.p?.mapId||STARTING_MAP);
    const coordinates=e=>atlasPoint(canvas,e);
    bindAtlasZoom(canvas,{show:id=>this.showAtlas(id),redraw:()=>this.drawMap(canvas,true),hideTooltip:()=>$('#map-marker-tooltip').classList.add('hidden')});
    const hit=e=>{const p=coordinates(e);return atlasHit(canvas.dataset.mapId,p.x,p.y);};
    const objective=e=>{const p=coordinates(e);return hitAtlasQuest(canvas.atlasHits||[],p.x,p.y)||(canvas.atlasServices||[]).find(s=>Math.hypot(s.x-p.x,s.y-p.y)<12);};
    canvas.onclick=e=>{if(canvas.atlasDragged){canvas.atlasDragged=false;return;}const q=objective(e);if(q?.kind==='service'&&['flight','capital'].includes(q.serviceType)){this.openTravel(q.id);return;}if(q?.kind==='zoneQuests'){this.showAtlas(q.navigate);return;}if(q?.quests?.length){const index=(q.quests.indexOf(this.p.trackedQuest)+1)%q.quests.length;this.send({type:'trackQuest',id:q.quests[index]});return;}const child=hit(e);if(child)this.showAtlas(child.id);};
    canvas.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();up();};
    canvas.onpointermove=e=>{if(e.buttons===1)return;const child=hit(e),q=objective(e);canvas.dataset.hoverMap=child?.id||'';canvas.style.cursor=q?.kind==='service'?'help':q?'pointer':child?'zoom-in':'default';status.textContent=q?q.title:child?`${child.name} · Click to open`:this.atlasHint();const tip=$('#map-marker-tooltip');if(q){tip.querySelector('strong').textContent=q.title;tip.querySelector('span').textContent=q.detail;tip.classList.remove('hidden');tip.style.left=`${Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,e.clientX+14))}px`;tip.style.top=`${Math.max(52,Math.min(innerHeight-tip.offsetHeight-10,e.clientY+14))}px`;}else tip.classList.add('hidden');this.drawMap(canvas,true);};
    canvas.onpointerleave=()=>{$('#map-marker-tooltip').classList.add('hidden');canvas.dataset.hoverMap='';status.textContent=this.atlasHint();if(canvas.isConnected)this.drawMap(canvas,true);};
    canvas.onkeydown=e=>{if(['ArrowLeft','Backspace','ArrowRight','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='ArrowLeft'||e.key==='Backspace')up();else{const child=atlasChildren(canvas.dataset.mapId).find(c=>c.charted);if(child)this.showAtlas(child.id);}}};
    this.showAtlas(this.atlasId||this.p?.mapId||STARTING_MAP);
  }
  atlasHint(){const map=atlasMap(this.atlasId);return map.kind==='Zone'?'Finest available chart · Pale edges are uncharted':atlasChildren(map.id).some(c=>c.charted)?'Choose an inked region · Blank parchment is uncharted':'No finer chart is available';}
  showAtlas(id){
    const map=atlasMap(id),w=this.windows.get('map'),canvas=$('#zone-map');if(!w||!canvas)return;
    $('#map-marker-tooltip').classList.add('hidden');this.atlasId=map.id;canvas.atlasView={x:0,y:0,scale:1};canvas.dataset.mapId=map.id;canvas.dataset.hoverMap='';canvas.style.cursor='default';canvas.setAttribute('aria-label',`${map.name}, ${map.kind.toLowerCase()} map. Left-click a charted region to open it. Scroll to zoom into regions or out to the parent map. Drag to pan. Right-click to go up. Arrow keys also navigate. Bed symbols mark inns, wings mark flight stones, and towers mark capitals.`);w.title.textContent=`World atlas · ${map.name}`;
    $('#atlas-up').disabled=!map.parent;
    $('#atlas-breadcrumbs').innerHTML=atlasTrail(map.id).map(c=>`<button data-atlas-map="${c.id}" ${c.id===map.id?'aria-current="page"':''}>${c.name}</button>`).join('<span aria-hidden="true">›</span>');
    const children=atlasChildren(map.id);$('#atlas-regions').innerHTML=children.length?'<span>Charted regions:</span>'+children.map(c=>`<button data-atlas-map="${c.id}" ${c.charted?'':'disabled'}>${c.name}${c.charted?' ↘':' · Uncharted'}</button>`).join(''):'<span class="atlas-key">◆ You &nbsp; ● Adventurers &nbsp; ① Quest objectives &nbsp; ! Quest givers</span>';
    for(const button of w.body.querySelectorAll('[data-atlas-map]'))button.onclick=()=>this.showAtlas(button.dataset.atlasMap);
    $('#atlas-status').textContent=this.atlasHint();this.drawMap(canvas,true);
  }
  toggleHelp(){if(this.windows.get('help'))return this.windows.close('help');const w=this.windows.open('help','Adventurer’s Guide',{width:432,left:30,top:165,paper:true});w.body.innerHTML='<h2>Your first steps</h2><p>These are the default controls. Open Game menu → Keybindings to customize them.</p><p>Speak to nearby quest givers, follow your journal and map, and visit local services for supplies and storage.</p><dl class="help-keys"><dt>W/S · A/D</dt><dd>Forward/back · Strafe</dd><dt>Q / E</dt><dd>Turn left / right</dd><dt>R / Mouse Back</dt><dd>Autorun (W, S or toggle again stops)</dd><dt>Space</dt><dd>Jump</dd><dt>Left-click character</dt><dd>Select without attacking</dd><dt>Right-click enemy</dt><dd>Select & autoattack</dd><dt>Left-drag</dt><dd>Look around without turning</dd><dt>Right-drag / wheel</dt><dd>Steer / zoom camera (cursor stays captured during drag)</dd><dt>Both mouse buttons</dt><dd>Move forward while both are held</dd><dt>Tab</dt><dd>Cycle enemies</dd><dt>1–9, 0, -, =</dt><dd>Use action bar slots</dd><dt>F / right-click</dt><dd>Talk, gather, open loot</dd><dt>Shift-right-click</dt><dd>Quick loot corpse</dd><dt>B / C / P</dt><dd>Bags / character / spellbook</dd><dt>J or L / M</dt><dd>Quest log / map</dd><dt>Escape</dt><dd>Release camera / close top window / clear target</dd><dt>Enter / /</dt><dd>Chat / emote autocomplete</dd></dl><p>Right-click bag items to equip or use. Hover over gear to compare it with your equipment. Drag learned spells from your spellbook to the bar; Shift-drag to rearrange locked slots.</p><p>Your level-2 skill depends on your class: Dawnwardens recover themselves, Arcanists gain a personal barrier, Pathfinders bandage themselves, and Stormcallers heal allies. Stormcallers later learn party healing and ally shields. Select a player and use Invite to party; accept invitations to form a group of up to five. Click party frames to select a member. Use the minimap tracking menu to expand objective-type filters.</p><p>You can move with windows open. Walk away from a person or corpse to close that conversation or loot window.</p>';}
  bindTooltips(){
    document.addEventListener('pointerover',e=>{const anchor=e.target.closest('[data-item],[data-action-id],[data-equipment]');if(anchor){this.tooltipAnchor=anchor;this.refreshTooltip();}});
    document.addEventListener('pointerout',e=>{if(this.tooltipAnchor&&!this.tooltipAnchor.contains(e.relatedTarget)){this.tooltipAnchor=null;$('#game-tooltip').classList.add('hidden');}});
    document.addEventListener('focusin',e=>{const anchor=e.target.closest('[data-item],[data-action-id],[data-equipment]');if(anchor){this.tooltipAnchor=anchor;this.refreshTooltip();}});
    document.addEventListener('focusout',()=>{this.tooltipAnchor=null;$('#game-tooltip').classList.add('hidden');});
  }
  refreshTooltip(){
    const anchor=this.tooltipAnchor,tip=$('#game-tooltip');if(!anchor?.isConnected||!this.p||this.pointerDrag?.active)return tip.classList.add('hidden');let html='';
    if(anchor.dataset.item){
      const id=anchor.dataset.item,item=ITEMS[id];if(!item)return;const transaction=anchor.dataset.transaction,actionHelp=({attach:'Right-click to attach one · Shift-right-click to attach this stack',detach:'Click to remove this attachment',mailItem:'Collect attachments to move these into your bags',buy:'Right-click to buy one',sell:'Right-click to sell one · Shift-right-click to sell this stack',deposit:'Right-click to deposit one · Shift-right-click to deposit this stack',withdraw:'Right-click to withdraw one · Shift-right-click to withdraw this stack'})[transaction];const compatible=compatibleEquipmentSlots(item),equippedSlot=equipmentSlot(anchor.dataset.equipment);
      const comparisons=equippedSlot?'':compatible.map(slot=>{
        const equippedId=this.p.equipment[slot.id],equipped=ITEMS[equippedId];
        const changes=Object.entries(ITEM_STATS).filter(([stat])=>(item[stat]||0)!==(equipped?.[stat]||0)).map(([stat,label])=>{const diff=(item[stat]||0)-(equipped?.[stat]||0);return `<span class="${diff>0?'stat-gain':'stat-loss'}">${diff>0?'+':''}${diff} ${label}</span>`;}).join('');
        return `<div class="tooltip-comparison" data-compare-slot="${slot.id}"><div class="tooltip-equipped-header"><i class="tooltip-item-icon ${equipped?.quality||'empty'}">${icon(equippedId||slot.icon)}</i><div><small>${equipped?'Currently equipped':'Equipment slot'} · ${slot.name}</small><strong class="quality-${equipped?.quality||'empty'}">${equipped?.name||`${slot.name}: Empty`}</strong></div></div>${equipped?`<div class="tooltip-equipped-stats">${itemStats(equipped)}</div>`:''}<div class="tooltip-stat-changes"><small>If equipped in ${slot.name}</small>${changes||'<span>No stat change</span>'}</div></div>`;
      }).join('');
      html=`<strong class="quality-${item.quality}">${item.name}</strong><span>${RARITIES[item.quality]?.name||'Common'}</span>${equippedSlot?`<span>Currently equipped · ${equippedSlot.name}</span>`:''}${item.quest?'<span class="tooltip-quest">Quest Item</span>':''}${item.bagSlots?`<span>Bag</span><div>+${item.bagSlots} storage slots</div><span class="${this.p.level<(item.minLevel||1)?'stat-loss':''}">Requires level ${item.minLevel||1}</span>`:''}${item.slot?`<span>${compatible.map(slot=>slot.name).join(' / ')}</span>`:''}${itemStats(item)}${item.armorType?`<span class="${armorAllowed(this.p.classId,item.armorType)?'':'stat-loss'}">${item.armorType[0].toUpperCase()+item.armorType.slice(1)} armor${armorAllowed(this.p.classId,item.armorType)?'':' · Not trained'}</span>`:''}${item.allowedClasses?`<span class="${item.allowedClasses.includes(this.p.classId)?'':'stat-loss'}">${item.allowedClasses.map(id=>classDefinition(id).name).join(', ')} only</span>`:''}<p>${item.description}</p>${comparisons}${transaction==='buy'?`<span class="tooltip-price">Buy price: ${money(item.price)}</span>`:''}${item.sell?`<span class="tooltip-price">Sell price: ${money(item.sell)}</span>`:''}<small>${actionHelp|| (equippedSlot?'Right-click to unequip':item.quest?'Collected for an active quest':item.bagSlots?'Right-click to equip a bag':item.slot?'Right-click to equip':item.consumable?'Right-click to drink':'Trade good')}</small>`;
    }else if(anchor.dataset.equipment){
      const slot=equipmentSlot(anchor.dataset.equipment);if(!slot)return tip.classList.add('hidden');
      html=`<strong>${slot.name}</strong><span>Empty equipment slot</span><p>${slot.starter?'Equip a compatible item from your bags.':MERCHANT_STOCK.some(id=>canEquipInSlot(id,slot.id))?'Merchants stock gear for this slot. Find more options in later adventures.':'No starter-zone gear is available for this slot yet. Look for more options in later adventures.'}</p>${slot.id.startsWith('ring')||['charm','trinket2'].includes(slot.id)?'<small>Drag compatible jewelry to choose either slot.</small>':''}`;
    }else{
      const id=anchor.dataset.actionId,s=SKILLS[id],emote=EMOTES[actionEmote(id)];if(emote){html=`<strong>${emote.name}</strong><span>/${emote.id} ${knowsEmote(this.p,emote.id)?'':`Reward: ${emote.unlock}`}</span><p>${emote.description}</p><small>Use a selected character within 15 paces, or Everyone nearby in the Emotes book.<br>Click to use · Shift-click or drag to bind an action slot.</small>`;}else if(ITEMS[id]?.consumable){html=`<strong>${esc(ITEMS[id]?.name||'Healing tonic')}</strong><p>Restores 80 health.</p><span>8 second cooldown</span><small>${this.p.inventory[id]||0} in your bags</small>`;}else if(id==='auto'){html=`<strong>Auto Attack</strong><span>${classDefinition(this.p.classId).autoRange} pace range</span><p>Automatically attack your selected enemy. Right-click an enemy to begin.</p>`;}else if(s){html=`<strong>${s.name}</strong><span>Rank 1</span><div class="tooltip-spell-stats"><span>${s.cost} ${classDefinition(this.p.classId).resource.toLowerCase()}</span><span>${s.travel?`Bound: ${this.p.waypoint?.name||UI_CONFIG.home||'Home'}`:s.selfOnly||s.shield&&!s.friendlyTarget?'Self only':s.partyHeal?`Party · ${s.range} paces`:s.heal||s.friendlyTarget?`Friendly · ${s.range} paces`:`${s.range} pace range`}</span></div><div class="tooltip-spell-stats"><span>${s.castTime?`${s.castTime} sec cast`:"Instant"}</span><span>${s.travel?'15 min':`${s.cooldown} sec`} cooldown</span></div>${s.triggersGCD===false?'':`<span>${GLOBAL_COOLDOWN} sec global cooldown</span>`}<p>${s.description}</p>${this.p.level<s.level?`<span class="stat-loss">Requires level ${s.level}</span>`:''}<small>Drag to an action bar slot</small>`;}
    }
    if(!html)return tip.classList.add('hidden');tip.innerHTML=html;tip.classList.remove('hidden');const r=anchor.getBoundingClientRect();let x=r.right+10,y=r.top;if(x+tip.offsetWidth>innerWidth-10)x=r.left-tip.offsetWidth-10;if(x<10)x=Math.max(10,Math.min(innerWidth-tip.offsetWidth-10,r.left));y=Math.max(52,Math.min(innerHeight-tip.offsetHeight-12,y));tip.style.left=`${x}px`;tip.style.top=`${y}px`;
  }
}
