import {UI_CONFIG} from './world-ui.js';
import {BINDING_ACTIONS,eventBinding,bindingLabel,validBinding} from './settings.js';
export class GameMenu{
 constructor({preferences,onOpen,onChange,onLogout,onHelp,getAutoLoot,setAutoLoot}){Object.assign(this,{preferences,onOpen,onChange,onLogout,onHelp,getAutoLoot,setAutoLoot});this.root=document.querySelector('#game-menu');this.panel=this.root.querySelector('.menu-panel');this.content=this.root.querySelector('#game-menu-content');this.page='home';this.capture=null;this.busy=false;this.root.addEventListener('click',e=>{if(e.target===this.root&&!this.busy)this.hide();});}
 get visible(){return !this.root.classList.contains('hidden');}
 open(page='home'){if(this.busy)return;this.previousFocus=document.activeElement;this.page=page;this.capture=null;this.onOpen();this.root.classList.remove('hidden');this.render();}
 hide(){if(this.busy)return;this.capture=null;this.root.classList.add('hidden');if(this.previousFocus?.isConnected)this.previousFocus.focus();else document.activeElement?.blur();}
 reset(){this.busy=false;this.capture=null;this.root.classList.add('hidden');}
 setBusy(){this.busy=true;this.capture=null;this.render();}
 render(){
  this.panel.classList.toggle('wide',this.page!=='home');this.root.querySelector('#game-menu-title').textContent=this.page==='keys'?'Keybindings':this.page==='options'?'Settings':'Game menu';
  if(this.busy){this.content.innerHTML='<p class="menu-saving" role="status">Saving your character and logging out…</p>';return;}
  const back='<button class="menu-back" data-page="home">‹ Game menu</button>';
  if(this.page==='home')this.content.innerHTML='<p class="menu-subtitle" data-world-region></p><div class="menu-buttons"><button data-resume>Return to game</button><button data-page="options">Settings</button><button data-page="keys">Keybindings</button><button data-help>Help & controls</button><button data-logout class="logout-button">Log out</button></div><p class="menu-note">The world continues while this menu is open.</p>';
  else if(this.page==='options'){
   const s=this.preferences.settings;
   this.content.innerHTML=back+`<div class="menu-options"><label><span>Sound</span><input type="checkbox" data-setting="sound" ${s.sound?'checked':''}></label><label><span>Master volume</span><input type="range" min="0" max="100" value="${Math.round(s.volume*100)}" data-setting="volume"><output>${Math.round(s.volume*100)}%</output></label><label><span>Camera sensitivity</span><input type="range" min="25" max="200" value="${Math.round(s.cameraSensitivity*100)}" data-setting="cameraSensitivity"><output>${s.cameraSensitivity.toFixed(2)}×</output></label><label><span>Graphics quality</span><select data-setting="quality">${[['low','Low'],['balanced','Balanced'],['high','High']].map(([id,label])=>`<option value="${id}" ${s.quality===id?'selected':''}>${label}</option>`).join('')}</select></label><label><span>Foliage & water motion</span><input type="checkbox" data-setting="ambientMotion" ${s.ambientMotion?'checked':''}></label><label><span>Show FPS & network latency</span><input type="checkbox" data-setting="showPerformance" ${s.showPerformance?'checked':''}></label><label><span>Auto Loot</span><input type="checkbox" data-auto-loot ${this.getAutoLoot()?'checked':''}></label></div><p class="menu-note">Changes apply immediately and are saved in this browser.</p>`;
   this.content.querySelectorAll('[data-setting]').forEach(input=>input.oninput=()=>{const key=input.dataset.setting,value=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value)/100:input.value;this.preferences.set(key,value);if(input.type==='range')input.nextElementSibling.textContent=key==='volume'?`${input.value}%`:`${value.toFixed(2)}×`;this.onChange();});this.content.querySelector('[data-auto-loot]').onchange=e=>this.setAutoLoot(e.target.checked);
  }else{
   let group='';const rows=BINDING_ACTIONS.map(action=>{let title='';if(action.group!==group){group=action.group;title=`<h3>${group}</h3>`;}return title+`<div class="binding-row"><span>${action.label}</span>${this.preferences.bindings[action.id].map((key,index)=>`<div class="binding-cell"><button data-bind="${action.id}" data-index="${index}" aria-label="${action.label} binding ${index+1}" title="${bindingLabel(key)}" class="${this.capture?.action===action.id&&this.capture.index===index?'listening':''}">${this.capture?.action===action.id&&this.capture.index===index?'Press key or mouse…':bindingLabel(key)}</button><button class="binding-clear" data-clear="${action.id}" data-index="${index}" aria-label="Clear ${action.label} binding ${index+1}">×</button></div>`).join('')}</div>`;}).join('');
   this.content.innerHTML=back+'<p class="menu-note">Select a binding and press a key or a middle/side mouse button, with optional Ctrl, Alt, or Shift. Escape cancels. Escape stays reserved for the menu; / opens emote chat.</p><div id="binding-status" role="status">'+(this.status||'Each action has two optional bindings.')+'</div><div class="binding-scroll">'+rows+'</div><button class="binding-reset" data-reset>Restore default keybindings</button>';
   this.content.querySelectorAll('[data-bind]').forEach(button=>button.onclick=()=>{this.capture={action:button.dataset.bind,index:Number(button.dataset.index)};this.renderKeepingScroll();});this.content.querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{this.preferences.bind(button.dataset.clear,Number(button.dataset.index),null);this.capture=null;this.status='Binding cleared.';this.onChange();this.renderKeepingScroll();});this.content.querySelector('[data-reset]').onclick=()=>{this.preferences.resetBindings();this.capture=null;this.status='Default keybindings restored.';this.onChange();this.renderKeepingScroll();};
  }
  if(this.content.querySelector('[data-world-region]'))this.content.querySelector('[data-world-region]').textContent=UI_CONFIG.region||'';
  this.content.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{this.page=button.dataset.page;this.capture=null;this.render();});this.content.querySelector('[data-resume]')?.addEventListener('click',()=>this.hide());this.content.querySelector('[data-logout]')?.addEventListener('click',()=>this.onLogout());this.content.querySelector('[data-help]')?.addEventListener('click',()=>{this.hide();this.onHelp();});this.content.querySelector('button,input,select')?.focus();
 }
 renderKeepingScroll(){const top=this.content.querySelector('.binding-scroll')?.scrollTop||0;this.render();const scroll=this.content.querySelector('.binding-scroll');if(scroll)scroll.scrollTop=top;}
 bindCaptured(key){
  if(!validBinding(key)){this.status='That shortcut is reserved by the game or browser. Choose another key.';this.renderKeepingScroll();return;}
  const moved=this.preferences.bind(this.capture.action,this.capture.index,key);this.capture=null;this.status=moved.length?`${bindingLabel(key)} reassigned from ${moved.join(', ')}.`:`Bound to ${bindingLabel(key)}.`;this.onChange();this.renderKeepingScroll();
 }
 handlePointerDown(e){
  if(!this.visible)return false;
  if(this.capture&&[1,3,4].includes(e.button)){e.preventDefault();e.stopPropagation();const key=eventBinding(e);if(key)this.bindCaptured(key);}
  return true;
 }
 handleKeyDown(e){
  if(!this.visible)return false;
  if(this.busy){e.preventDefault();return true;}
  if(this.capture){e.preventDefault();e.stopPropagation();if(e.repeat)return true;if(e.code==='Escape'){this.capture=null;this.status='Binding change cancelled.';this.renderKeepingScroll();return true;}const key=eventBinding(e);if(!key)return true;this.bindCaptured(key);return true;}
  if(e.code==='Escape'){e.preventDefault();if(!e.repeat){if(this.page==='home')this.hide();else{this.page='home';this.render();}}return true;}
  if(e.code==='Tab'){const controls=[...this.content.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  return true;
 }
}
