import {WORLD_INFO} from '../shared/world-info.js';
import {UI_CONFIG} from './world-ui.js';

export function applyBranding(){
  const set=(selector,value)=>{const element=document.querySelector(selector);if(element)element.textContent=value;};
  document.documentElement.dataset.world=WORLD_INFO.id;
  document.title=`${WORLD_INFO.name} · ${UI_CONFIG.region||'Adventure'}`;
  set('.login-copy h1',WORLD_INFO.name);
  set('.login-copy>.eyebrow',(UI_CONFIG.region||WORLD_INFO.name).toUpperCase());
  set('.wordmark',`✦ ${WORLD_INFO.name.toUpperCase()}`);
  set('.menu-heading>span',`✦ ${WORLD_INFO.name.toUpperCase()}`);
  set('.login-bottom>span:last-child',`PLAYABLE ALPHA · LEVELS 1–${WORLD_INFO.levelCap}`);
  set('#roster-empty',`Your first story starts here. Choose a race and class to enter ${UI_CONFIG.entryLabel||'the world'}.`);
  set('#area',(UI_CONFIG.home||UI_CONFIG.region||WORLD_INFO.name).toUpperCase());
  set('#location-announcement small',(UI_CONFIG.region||WORLD_INFO.name).toUpperCase());
  set('#location-announcement strong',UI_CONFIG.home||WORLD_INFO.name);
  set('.minimap-heading>span',(UI_CONFIG.region||WORLD_INFO.name).toUpperCase());
  set('#disconnected h2',`${WORLD_INFO.name} is out of sight.`);
  document.querySelector('#world')?.setAttribute('aria-label',`${WORLD_INFO.name} 3D game world`);
  const tagline=[...document.querySelector('.login-top').childNodes].find(node=>node.nodeType===3&&node.textContent.trim());
  if(tagline)tagline.textContent=` ${UI_CONFIG.tagline||'YOUR NEXT ADVENTURE'} `;
}
