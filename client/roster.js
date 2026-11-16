import {UI_CONFIG} from './world-ui.js';
import {storageKey} from '../shared/world-storage.js';
import {CHARACTER_LOOKS,CUSTOMIZATION_OPTIONS,normalizeAppearance,appearancePalette} from '../shared/character.js';
import {RACES,normalizeIdentity,classDefinition,raceDefinition,validRaceClass} from '../shared/adventurers.js';
import {CharacterPreview} from './character-preview.js';
import {IdentityPicker} from './identity-picker.js';
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readAccount=value=>{if(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value))return value;return JSON.parse(value||'null')?.token;};
export class CharacterRoster{
  constructor({storage,onEnter,developer=false}){
    this.developer=developer;
    this.storage=storage;this.onEnter=onEnter;this.characters=[];this.revision=0;this.limit=12;this.creating=true;this.busy=true;this.look='hearth';this.appearance=normalizeAppearance();this.editing=false;Object.assign(this,normalizeIdentity());this.preview=new CharacterPreview($('#character-preview'));
    try{this.token=readAccount(storage?.getItem(storageKey('account')));this.selectedId=storage?.getItem(storageKey('selected-character'));this.legacy=JSON.parse(storage?.getItem(storageKey('character')))?.token;}catch{}
    this.identityPicker=new IdentityPicker({onRace:id=>{this.raceId=id;if(!validRaceClass(id,this.classId))this.classId=RACES[id].classes[0];this.render();},onClass:id=>{this.classId=id;this.render();}});
    $('#look-options').innerHTML=Object.entries(CHARACTER_LOOKS).map(([id,p])=>`<button type="button" data-look="${id}" aria-label="${p.name} appearance" aria-pressed="${id===this.look}" style="--skin:${p.skin};--hair:${p.hair}"><i></i>${p.name}</button>`).join('');
    $('#look-options').onclick=e=>{const b=e.target.closest('[data-look]');if(b&&!this.busy){this.look=b.dataset.look;this.appearance=normalizeAppearance(null,this.look);this.render();}};
    const labels={skin:'Skin tone',hairColor:'Hair color',hairStyle:'Hairstyle',facialHair:'Facial hair',eyeColor:'Eye color',face:'Face shape',build:'Build'};
    $('#appearance-controls').innerHTML=Object.entries(CUSTOMIZATION_OPTIONS).map(([field,options])=>['skin','hairColor','eyeColor'].includes(field)?`<fieldset class="appearance-control"><legend>${labels[field]}</legend><div class="appearance-swatches">${Object.entries(options).map(([id,o])=>`<button type="button" data-appearance-field="${field}" data-value="${id}" aria-label="${labels[field]}: ${o.name}" title="${o.name}" style="--swatch:${o.color}"></button>`).join('')}</div></fieldset>`:`<label class="appearance-control">${labels[field]}<select data-appearance-field="${field}" aria-label="${labels[field]}">${Object.entries(options).map(([id,o])=>`<option value="${id}">${o.name}</option>`).join('')}</select></label>`).join('');
    $('#appearance-controls').onclick=e=>{const b=e.target.closest('button[data-appearance-field]');if(b&&!this.busy){this.appearance={...this.appearance,[b.dataset.appearanceField]:b.dataset.value};this.render();}};
    $('#appearance-controls').onchange=e=>{const select=e.target.closest('select[data-appearance-field]');if(select&&!this.busy){this.appearance={...this.appearance,[select.dataset.appearanceField]:select.value};this.render();}};
    $('#randomize-appearance').onclick=()=>{if(this.busy)return;this.appearance=Object.fromEntries(Object.entries(CUSTOMIZATION_OPTIONS).map(([field,options])=>{const ids=Object.keys(options);return [field,ids[Math.floor(Math.random()*ids.length)]];}));this.render();};
    $('#customize-character').onclick=()=>this.editAppearance();
    $('#join-form').onsubmit=e=>{e.preventDefault();this.enter();};
    $('#name').oninput=()=>{if(this.creating)$('#selected-character-name').textContent=$('#name').value||`New ${classDefinition(this.classId).name}`;};
    $('#save-character').onclick=()=>this.create(false);$('#new-character').onclick=()=>this.newCharacter();$('#cancel-create').onclick=()=>{this.creating=false;this.editing=false;this.render();};
    $('#roster-retry').onclick=()=>this.initialize();
    const previewView=face=>{this.preview.setView(face);$('#preview-face').setAttribute('aria-pressed',String(face));$('#preview-body').setAttribute('aria-pressed',String(!face));};
    $('#preview-face').onclick=()=>previewView(true);$('#preview-body').onclick=()=>previewView(false);
    $('#preview-left').onclick=()=>{this.preview.angle-=Math.PI/4;};$('#preview-right').onclick=()=>{this.preview.angle+=Math.PI/4;};
    $('#character-list').onclick=e=>{
      const b=e.target.closest('button');if(!b||this.busy)return;
      if(b.dataset.select)this.select(b.dataset.select);
      if(b.dataset.move)this.move(b.dataset.id,Number(b.dataset.move));
      if(b.dataset.delete)this.confirmDelete(b.dataset.delete);
    };
    let dragId=null;
    $('#character-list').ondragstart=e=>{if(this.busy||e.target.closest('button:not(.character-select)'))return e.preventDefault();dragId=e.target.closest('[data-character-id]')?.dataset.characterId;if(dragId){e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';}};
    $('#character-list').ondragover=e=>{if(dragId)e.preventDefault();};
    $('#character-list').ondrop=e=>{e.preventDefault();const target=e.target.closest('[data-character-id]')?.dataset.characterId;if(!dragId||!target||dragId===target)return;const ids=this.characters.map(c=>c.id),from=ids.indexOf(dragId),to=ids.indexOf(target);if(from<0||to<0)return;ids.splice(from,1);ids.splice(to,0,dragId);dragId=null;this.reorder(ids);};
    $('#character-list').ondragend=()=>{dragId=null;};
    const dialog=$('#delete-character-dialog');$('#cancel-delete-character').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{this.deleting=null;});
    $('#confirm-delete-character').onclick=async()=>{if(!this.deleting||this.busy)return;const c=this.deleting;this.setBusy(true);try{const data=await this.api(`/api/characters/${c.id}`,'DELETE',{confirmName:c.name,revision:this.revision});dialog.close();this.apply(data);$('#login-status').textContent=`${c.name} was deleted.`;$('#new-character').focus();}catch(e){$('#delete-character-error').textContent=e.message;}finally{this.setBusy(false);}};
    window.addEventListener('focus',()=>{if(!$('#login').classList.contains('hidden')&&!this.busy)this.refresh();});
    setInterval(()=>{if(!document.hidden&&!$('#login').classList.contains('hidden')&&!$('#delete-character-dialog').open&&!this.busy)this.refresh();},3000);
    this.render();this.ready=this.initialize();
  }
  async api(path,method='GET',body){
    const response=await fetch(path,{method,headers:{'Content-Type':'application/json',...(this.token?{Authorization:`Bearer ${this.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok){if(data.characters)this.apply(data);throw Error(data.error||'Could not load your characters.');}return data;
  }
  async initialize(){
    this.setBusy(true);$('#roster-retry').classList.add('hidden');
    try{const data=await this.api('/api/session','POST',{token:this.token,legacyToken:this.legacy});this.token=data.token;try{this.storage?.setItem(storageKey('account'),JSON.stringify({token:this.token}));this.storage?.removeItem(storageKey('character'));}catch{}this.creating=data.characters.length===0;this.apply(data);$('#login-error').textContent='';}
    catch(e){$('#login-error').textContent=e.message;$('#roster-retry').classList.remove('hidden');}
    finally{this.setBusy(false);}
  }
  async refresh(){if(!this.token||this.refreshing)return;this.refreshing=true;try{this.apply(await this.api('/api/characters'));}catch(e){$('#login-error').textContent=e.message;}finally{this.refreshing=false;}}
  apply(data){if(data.revision<this.revision)return;const signature=JSON.stringify([data.characters,data.revision,data.limit]);if(signature===this.appliedSignature)return;this.appliedSignature=signature;const hadCharacters=this.characters.length>0;this.characters=data.characters;this.revision=data.revision;this.limit=data.limit;if(!this.characters.some(c=>c.id===this.selectedId))this.selectedId=this.characters[0]?.id||null;if(!this.characters.length){this.creating=true;if(hadCharacters)$('#name').value='';}this.render();}
  get selected(){return this.characters.find(c=>c.id===this.selectedId);}
  setBusy(value){this.busy=value;this.render();$('#confirm-delete-character').disabled=value;$('#cancel-delete-character').disabled=value;}
  select(id){this.selectedId=id;this.creating=false;this.editing=false;this.look=this.selected?.look||'hearth';this.appearance=normalizeAppearance(this.selected?.appearance,this.look);try{this.storage?.setItem(storageKey('selected-character'),id);}catch{}$('#login-error').textContent='';this.preview.angle=.2;this.render();}
  newCharacter(){this.creating=true;this.editing=false;$('#name').value='';$('#login-error').textContent='';this.look='hearth';Object.assign(this,normalizeIdentity());this.appearance=normalizeAppearance();$('#appearance-details').open=true;this.render();$('#name').focus();}
  async enter(){if(this.busy||!this.token)return;if(this.editing)return this.saveAppearance();if(this.creating)return this.create(true);if(this.selected&&!this.selected.online){$('#login-error').textContent='';this.onEnter(this.selected.id,this.token);}}
  async create(enter){
    if(this.busy||!this.token||!$('#join-form').reportValidity())return;
    this.setBusy(true);$('#login-error').textContent='';
    try{const data=await this.api(this.developer?'/api/developer/characters':'/api/characters','POST',{name:$('#name').value.trim(),look:this.look,appearance:this.appearance,raceId:this.raceId,classId:this.classId,revision:this.revision});this.creating=false;this.selectedId=data.createdId;this.apply(data);this.select(data.createdId);if(enter)this.onEnter(data.createdId,this.token);}
    catch(e){$('#login-error').textContent=e.message;}finally{this.setBusy(false);}
  }
  editAppearance(){if(this.busy||!this.selected||this.selected.online)return;this.creating=false;this.editing=true;this.look=this.selected.look;this.appearance=normalizeAppearance(this.selected.appearance,this.look);$('#appearance-details').open=true;$('#login-error').textContent='';this.render();}
  async saveAppearance(){if(this.busy||!this.selected)return;this.setBusy(true);$('#login-error').textContent='';try{const id=this.selected.id,data=await this.api(`/api/characters/${id}/appearance`,'PATCH',{look:this.look,appearance:this.appearance,revision:this.revision});this.editing=false;this.apply(data);this.select(id);$('#login-status').textContent='Appearance saved.';}catch(e){$('#login-error').textContent=e.message;}finally{this.setBusy(false);}}
  move(id,direction){const ids=this.characters.map(c=>c.id),from=ids.indexOf(id),to=from+direction;if(from<0||to<0||to>=ids.length)return;[ids[from],ids[to]]=[ids[to],ids[from]];this.reorder(ids);}
  async reorder(ids){if(this.busy)return;this.setBusy(true);try{this.apply(await this.api('/api/characters/order','PATCH',{ids,revision:this.revision}));$('#login-error').textContent='';}catch(e){$('#login-error').textContent=e.message;}finally{this.setBusy(false);}}
  confirmDelete(id){const c=this.characters.find(c=>c.id===id);if(!c||c.online)return;this.deleting=c;$('#delete-character-name').textContent=c.name;$('#delete-character-description').textContent=`Delete ${c.name}, level ${c.level} ${classDefinition(c.classId).name}? Their progress, equipment and inventory will be permanently removed.`;$('#delete-character-error').textContent='';$('#delete-character-dialog').showModal();$('#cancel-delete-character').focus();}
  render(){
    const selected=this.selected,customizing=this.creating||this.editing,c=customizing?{raceId:this.editing?selected?.raceId:this.raceId,classId:this.editing?selected?.classId:this.classId,name:this.editing?selected?.name:$('#name').value||`New ${classDefinition(this.classId).name}`,level:this.editing?selected?.level:1,look:this.look,appearance:this.appearance,equipment:this.editing?selected?.equipment:undefined,previewHideHeadgear:true}:selected;
    $('#character-list').innerHTML=this.characters.map((c,i)=>`<li data-character-id="${c.id}" draggable="${!this.busy}" class="character-card ${!this.creating&&c.id===this.selectedId?'selected':''}"><button class="character-select" data-select="${c.id}" aria-pressed="${!this.creating&&c.id===this.selectedId}" ${this.busy?'disabled':''}><span class="roster-portrait" style="--skin:${appearancePalette(c.appearance,c.look).skin};--hair:${appearancePalette(c.appearance,c.look).hair}">✦</span><span><strong>${escape(c.name)}</strong><small>Level ${c.level} · ${raceDefinition(c.raceId).name} ${classDefinition(c.classId).name}${c.online?' · Online':''}</small></span></button><span class="character-actions"><button data-id="${c.id}" data-move="-1" aria-label="Move ${escape(c.name)} up" ${this.busy||i===0?'disabled':''}>↑</button><button data-id="${c.id}" data-move="1" aria-label="Move ${escape(c.name)} down" ${this.busy||i===this.characters.length-1?'disabled':''}>↓</button><button data-delete="${c.id}" aria-label="Delete ${escape(c.name)}" ${this.busy||c.online?'disabled':''}>×</button></span></li>`).join('');
    $('#roster-empty').classList.toggle('hidden',this.characters.length>0);$('#roster-count').textContent=`${this.characters.length} / ${this.limit}`;
    $('#create-fields').classList.toggle('hidden',!customizing);$('#character-name-field').classList.toggle('hidden',this.editing);$('#creation-title').textContent=this.editing?'Customize appearance':`Create a ${classDefinition(this.classId).name}`;$('#character-list').classList.toggle('hidden',customizing);$('#new-character').classList.toggle('hidden',customizing);$('#customize-character').classList.toggle('hidden',customizing||!selected);$('#customize-character').disabled=this.busy||!selected||selected.online;$('#name').required=this.creating;$('#name').readOnly=!this.creating;$('#name').disabled=this.busy;if(!this.creating)$('#name').value=selected?.name||'';
    $('#new-character').disabled=this.busy||this.characters.length>=this.limit;$('#cancel-create').classList.toggle('hidden',!this.characters.length);$('#save-character').disabled=this.busy||!this.token;
    $('#join').disabled=this.busy||!this.token||(!this.creating&&(!selected||selected.online));$('#join').textContent=this.busy?'Loading…':this.editing?'Save appearance':this.creating?`Create & enter ${UI_CONFIG.entryLabel||'the world'}`:selected?.online?'Playing in another tab':`Enter ${UI_CONFIG.entryLabel||'the world'} →`;
    $('#save-character').classList.toggle('hidden',!this.creating);$('#selected-character-name').textContent=c?.name||'Your next adventure';$('#selected-character-level').textContent=c?`Level ${c.level} · ${raceDefinition(c.raceId).name} ${classDefinition(c.classId).name}`:'Choose a character';
    for(const b of document.querySelectorAll('[data-look]')){b.disabled=this.busy;b.setAttribute('aria-pressed',String(b.dataset.look===this.look&&JSON.stringify(this.appearance)===JSON.stringify(normalizeAppearance(null,b.dataset.look))));}
    $('#randomize-appearance').disabled=this.busy;$('#customization-headgear-note').classList.toggle('hidden',!customizing||!c?.equipment?.head);
    for(const input of document.querySelectorAll('[data-appearance-field]')){input.disabled=this.busy;const field=input.dataset.appearanceField;if(input.tagName==='SELECT')input.value=this.appearance[field];else input.setAttribute('aria-pressed',String(input.dataset.value===this.appearance[field]));}
    $('#login').classList.toggle('creating-character',this.creating);$('#identity-fields').classList.toggle('hidden',!this.creating);this.identityPicker.update({raceId:this.raceId,classId:this.classId,busy:this.busy,visible:this.creating});$('#race-introduction').textContent=raceDefinition(this.raceId).description;$('#creation-class-description').textContent=`${classDefinition(c?.classId).name} · ${classDefinition(c?.classId).armor} · ${classDefinition(c?.classId).description}`;
    this.preview.setCharacter(c);$('#character-preview').setAttribute('aria-label',`3D appearance preview of ${c?.name||'a new adventurer'}`);
  }
  frame(dt){if(!$('#login').classList.contains('hidden'))this.preview.frame(dt);}
}
