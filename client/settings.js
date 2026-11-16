import {storageKey} from '../shared/world-storage.js';
// Browser-owned preferences and physical-key bindings. Escape remains the menu/cancel key.
export const BINDING_ACTIONS=[
 {id:'forward',label:'Move forward',group:'Movement',keys:['KeyW','ArrowUp']},{id:'backward',label:'Move backward',group:'Movement',keys:['KeyS','ArrowDown']},
 {id:'left',label:'Strafe left',group:'Movement',keys:['KeyA','ArrowLeft']},{id:'right',label:'Strafe right',group:'Movement',keys:['KeyD','ArrowRight']},{id:'jump',label:'Jump',group:'Movement',keys:['Space',null]},
 {id:'turnLeft',label:'Turn left',group:'Movement',keys:['KeyQ',null]},{id:'turnRight',label:'Turn right',group:'Movement',keys:['KeyE',null]},{id:'autorun',label:'Autorun',group:'Movement',keys:['KeyR','Mouse3']},
 {id:'interact',label:'Interact / loot',group:'Gameplay',keys:['KeyF',null]},{id:'target',label:'Next enemy',group:'Gameplay',keys:['Tab',null]},{id:'chat',label:'Open chat',group:'Gameplay',keys:['Enter',null]},
 {id:'bags',label:'Bags',group:'Windows',keys:['KeyB','KeyI']},{id:'character',label:'Character',group:'Windows',keys:['KeyC',null]},{id:'spellbook',label:'Spellbook',group:'Windows',keys:['KeyP',null]},
 {id:'journal',label:'Quest log',group:'Windows',keys:['KeyL','KeyJ']},{id:'map',label:'World map',group:'Windows',keys:['KeyM',null]},{id:'help',label:'Help',group:'Windows',keys:['KeyH',null]},
 ...['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'].map((code,i)=>({id:`action${i+1}`,label:`Action slot ${i+1}`,group:'Action bar',keys:[code,null]}))
];
export const DEFAULT_SETTINGS={sound:false,volume:.35,cameraSensitivity:1,quality:'balanced',showPerformance:true,ambientMotion:true};
export const defaultBindings=()=>Object.fromEntries(BINDING_ACTIONS.map(a=>[a.id,[...a.keys]]));
const MODIFIERS=['Control','Alt','Shift'];
const keyAllowed=code=>/^(Mouse[134]|Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|F([1-9]|10)|Numpad[0-9]|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Backquote)$/.test(code);
export function validBinding(binding){
 if(binding===null)return true;if(typeof binding!=='string')return false;
 const parts=binding.split('+'),code=parts.pop();if(!keyAllowed(code))return false;
 if(parts.some((p,i)=>!MODIFIERS.includes(p)||parts.indexOf(p)!==i)||parts.join('+')!==MODIFIERS.filter(m=>parts.includes(m)).join('+'))return false;
 if(code==='Slash'&&!parts.length)return false;
 if(['F5','F10'].includes(code))return false;
 if(parts.includes('Control')&&(['KeyW','KeyT','KeyN','KeyL','KeyR','KeyQ','F4','Tab'].includes(code)||parts.includes('Shift')&&['KeyI','KeyJ','KeyC'].includes(code)))return false;
 if(parts.includes('Alt')&&['F4','Tab','Home','ArrowLeft','ArrowRight'].includes(code))return false;
 return true;
}
export function eventBinding(e){const code=e.code||(Number.isInteger(e.button)?`Mouse${e.button}`:null);if(e.metaKey||!keyAllowed(code))return null;return [...(e.ctrlKey?['Control']:[]),...(e.altKey?['Alt']:[]),...(e.shiftKey?['Shift']:[]),code].join('+');}
export function bindingLabel(binding,compact=false){
 if(!binding)return compact?'—':'Unbound';const parts=binding.split('+'),code=parts.pop(),names={Mouse1:compact?'MMid':'Middle Mouse',Mouse3:compact?'MBack':'Mouse Back',Mouse4:compact?'MFwd':'Mouse Forward',Space:compact?'Spc':'Space',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Minus:'-',Equal:'=',Backquote:'`',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'};
 const key=names[code]||code.replace(/^Key|^Digit/,'').replace('Numpad','Num ');return [...parts.map(m=>compact?({Control:'C',Alt:'A',Shift:'S'})[m]:m==='Control'?'Ctrl':m),key].join(compact?'-':' + ');
}
export function sanitizeBindings(saved){
 const defaults=defaultBindings(),result={},seen=new Set();
 const unique=keys=>keys.map(key=>{if(!key||seen.has(key))return null;seen.add(key);return key;});
 // Existing custom bindings win over defaults for newly introduced actions.
 for(const action of BINDING_ACTIONS){const candidate=saved?.[action.id];if(Array.isArray(candidate)&&candidate.length===2&&candidate.every(validBinding))result[action.id]=unique(candidate);}
 for(const action of BINDING_ACTIONS)if(!result[action.id])result[action.id]=unique(defaults[action.id]);
 return result;
}
export function sanitizeSettings(value){const v=value||{},n=(key,min,max)=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key])):DEFAULT_SETTINGS[key];return {sound:typeof v.sound==='boolean'?v.sound:DEFAULT_SETTINGS.sound,volume:n('volume',0,1),cameraSensitivity:n('cameraSensitivity',.25,2),quality:['low','balanced','high'].includes(v.quality)?v.quality:DEFAULT_SETTINGS.quality,showPerformance:typeof v.showPerformance==='boolean'?v.showPerformance:true,ambientMotion:typeof v.ambientMotion==='boolean'?v.ambientMotion:true};}
export class Preferences{
 constructor(storage){this.storage=storage;let keys,settings;try{keys=JSON.parse(storage?.getItem(storageKey('keybindings')));settings=JSON.parse(storage?.getItem(storageKey('settings')));}catch{}this.bindings=sanitizeBindings(keys);this.settings=sanitizeSettings(settings);}
 save(){try{this.storage?.setItem(storageKey('keybindings'),JSON.stringify(this.bindings));this.storage?.setItem(storageKey('settings'),JSON.stringify(this.settings));}catch{}}
 set(key,value){this.settings=sanitizeSettings({...this.settings,[key]:value});this.save();}
 bind(action,index,key){if(!BINDING_ACTIONS.some(a=>a.id===action)||![0,1].includes(index)||!validBinding(key))return null;const displaced=[];if(key)for(const definition of BINDING_ACTIONS)for(let i=0;i<2;i++)if(this.bindings[definition.id][i]===key){if(definition.id!==action)displaced.push(definition.label);this.bindings[definition.id][i]=null;}this.bindings[action][index]=key;this.save();return displaced;}
 resetBindings(){this.bindings=defaultBindings();this.save();}
 actionForEvent(e){const key=eventBinding(e);if(!key)return null;const exact=BINDING_ACTIONS.find(a=>this.bindings[a.id].includes(key))?.id;if(exact)return exact;if(e.shiftKey&&this.bindings.interact.includes(key.split('+').filter(part=>part!=='Shift').join('+')))return 'interact';return null;}
 held(action,codes){return (this.bindings[action]||[]).some(key=>{if(!key)return false;const parts=key.split('+'),code=parts.pop();return codes.has(code)&&parts.every(mod=>[`${mod}Left`,`${mod}Right`].some(c=>codes.has(c)));});}
 label(action,compact=false){return bindingLabel(this.bindings[action]?.find(Boolean),compact);}
}
