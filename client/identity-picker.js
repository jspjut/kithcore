import {raceTraits,classStories,UI_CONFIG} from './world-ui.js';
import {RACES,CLASSES,CLASS_SKILLS,validRaceClass} from '../shared/adventurers.js';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(kind,id)=>`<svg aria-hidden="true" viewBox="0 0 64 64"><use href="/icons.svg#${kind}-${id}"/></svg>`;
export class IdentityPicker{
 constructor({onRace,onClass}){
  this.root=document.querySelector('#identity-fields');this.tip=document.querySelector('#creation-tooltip');
  for(const [kind,registry]of [['race',RACES],['class',CLASSES]]){
   const grid=document.querySelector(`#${kind}-choices`);
   grid.style.gridTemplateColumns=`repeat(${Math.min(5,Object.keys(registry).length)},minmax(0,1fr))`;
   grid.innerHTML=Object.values(registry).map(option=>`<button type="button" class="identity-choice" data-${kind}-choice="${option.id}" aria-pressed="false"><span class="identity-emblem">${icon(kind,option.id)}<span class="identity-selected" aria-hidden="true">✓</span><span class="identity-unavailable" aria-hidden="true">×</span></span><span>${escape(option.name)}</span></button>`).join('');
  }
  this.root.addEventListener('click',e=>{
   const b=this.button(e.target);if(!b||b.disabled||b.getAttribute('aria-disabled')==='true')return;
   if(b.dataset.raceChoice)onRace(b.dataset.raceChoice);else onClass(b.dataset.classChoice);
  });
  this.root.addEventListener('pointerover',e=>{const b=this.button(e.target);if(b&&!b.contains(e.relatedTarget))this.show(b);});
  this.root.addEventListener('pointerout',e=>{const b=this.button(e.target);if(b&&!b.contains(e.relatedTarget))this.hideSoon();});
  this.root.addEventListener('focusin',e=>{const b=this.button(e.target);if(b)this.show(b);});
  this.root.addEventListener('focusout',()=>this.hideSoon());
  this.tip.addEventListener('pointerenter',()=>clearTimeout(this.hideTimer));this.tip.addEventListener('pointerleave',()=>this.hideSoon());
  document.querySelector('#login').addEventListener('keydown',e=>{if(e.key==='Escape'&&!this.tip.classList.contains('hidden')){this.hide();e.preventDefault();e.stopPropagation();}});
  document.querySelector('.login-copy').addEventListener('scroll',()=>this.hide());window.addEventListener('resize',()=>this.hide());window.addEventListener('blur',()=>this.hide());
 }
 button(target){return target.closest?.('[data-race-choice],[data-class-choice]');}
 update({raceId,classId,busy,visible}){
  Object.assign(this,{raceId,classId,busy,visible});
  for(const b of this.root.querySelectorAll('.identity-choice')){
   const isRace=!!b.dataset.raceChoice,id=b.dataset.raceChoice||b.dataset.classChoice,unavailable=!isRace&&!validRaceClass(raceId,id);
   b.disabled=busy;b.setAttribute('aria-pressed',String(id===(isRace?raceId:classId)));b.setAttribute('aria-disabled',String(busy||unavailable));b.setAttribute('aria-label',`${(isRace?RACES:CLASSES)[id].name}${unavailable?` — unavailable to ${RACES[raceId].name}`:''}`);
  }
  document.querySelector('#chosen-race').textContent=RACES[raceId].name;document.querySelector('#chosen-class').textContent=CLASSES[classId].name;
  if(!visible||busy)this.hide();else if(this.anchor)this.show(this.anchor);
 }
 show(b){
  if(this.busy||!this.visible||b.disabled)return;clearTimeout(this.hideTimer);this.anchor?.removeAttribute('aria-describedby');this.anchor=b;
  const kind=b.dataset.raceChoice?'race':'class',id=b.dataset.raceChoice||b.dataset.classChoice,entry=(kind==='race'?RACES:CLASSES)[id];
  let body;
  if(kind==='race')body=`<p>${escape(entry.description)}</p><h4>Distinctive appearance</h4><p>${escape(raceTraits[id]||entry.appearanceDescription||entry.description)}</p><h4>Available classes</h4><p>${entry.classes.map(c=>CLASSES[c].name).join(' · ')}</p><p class="identity-tip-note">Starting stats and abilities depend on your class. Races have no stat bonuses.</p>`;
  else{
   const story=classStories[id]||{fantasy:entry.description,playstyle:entry.playstyle||entry.description,weapon:entry.weaponLabel||'Weapon'},early=entry.skills.slice(0,3).map(skill=>CLASS_SKILLS[skill]);
   const unavailable=!validRaceClass(this.raceId,id),races=Object.values(RACES).filter(r=>r.classes.includes(id)).map(r=>r.name);
   body=`${unavailable?`<div class="identity-tip-restriction"><strong>Unavailable to ${RACES[this.raceId].name}</strong><p>${escape(RACES[this.raceId].tradition)}</p><p>Choose ${races.join(', ')}.</p></div>`:''}<p>${story.fantasy}</p><div class="identity-tip-facts"><span>Armor training<strong>${entry.armor}</strong></span><span>Weapon<strong>${story.weapon}</strong></span><span>Resource<strong>${entry.resource}</strong></span></div><h4>Playstyle</h4><p>${story.playstyle}</p><h4>Early abilities</h4><ul>${early.map(s=>`<li><span>${s.name}</span><small>Level ${s.level}</small></li>`).join('')}</ul>`;
  }
  this.tip.innerHTML=`<div class="identity-tip-heading"><span class="identity-emblem">${icon(kind,id)}</span><div><small>${kind==='race'?escape(UI_CONFIG.peopleLabel||'Peoples of this world'):escape(entry.role)}</small><h3>${entry.name}</h3></div></div>${body}`;
  this.tip.dataset.kind=kind;this.tip.dataset.identity=id;this.tip.classList.remove('hidden');b.setAttribute('aria-describedby',this.tip.id);
  const r=b.getBoundingClientRect(),panel=this.root.getBoundingClientRect(),w=this.tip.offsetWidth,h=this.tip.offsetHeight;
  this.tip.style.left=`${Math.max(12,Math.min(innerWidth-w-12,panel.right+18+w<=innerWidth-12?panel.right+18:panel.left-w-18))}px`;
  this.tip.style.top=`${Math.max(12,Math.min(innerHeight-h-12,r.top))}px`;
 }
 hideSoon(){clearTimeout(this.hideTimer);this.hideTimer=setTimeout(()=>{if(this.anchor?.matches(':hover,:focus')||this.tip.matches(':hover'))return;this.hide();},140);}
 hide(){clearTimeout(this.hideTimer);this.anchor?.removeAttribute('aria-describedby');this.anchor=null;this.tip.classList.add('hidden');}
}
