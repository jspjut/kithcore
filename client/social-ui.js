import {EMOTES,FACTIONS,reputationRank} from '/shared/social.js';
export function emoteIcon(id){return `<span class="emote-glyph" aria-hidden="true">${EMOTES[id]?.glyph||'✦'}</span>`;}
export function characterTabs(ui,w){const nav=document.createElement('nav');nav.className='book-tabs';nav.innerHTML=[['equipment','Equipment'],['reputation','Reputation']].map(([id,name])=>`<button data-character-tab="${id}" class="${(ui.characterTab||'equipment')===id?'selected':''}">${name}</button>`).join('');nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{ui.characterTab=b.dataset.characterTab;ui.renderCharacter();});w.body.prepend(nav);}
export function renderReputation(ui,w){
 const entries=Object.entries(ui.p.reputation||{}).filter(([id])=>Object.hasOwn(FACTIONS,id));
 w.body.innerHTML=`<h2 class="reputation-title">People who know your name</h2><p class="social-intro">Groups appear after your first meeting. Quest work and new respectful encounters build trust.</p><div class="reputation-list">${entries.map(([id,n])=>{const f=FACTIONS[id],r=reputationRank(n);return `<article class="reputation-entry" data-faction="${id}"><div><strong>${f.name}</strong><span>${r.name} · ${n}${r.next===null?'':` / ${r.next}`}</span></div><progress max="1" value="${r.progress}" aria-label="${f.name} reputation"></progress><p>${f.description}</p>${f.help?`<small>${f.help}</small>`:''}</article>`;}).join('')||'<p class="reputation-empty">No groups discovered yet. Speak to a neighbor or greet someone with /wave.</p>'}</div>`;
 characterTabs(ui,w);
}
