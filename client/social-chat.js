import {emoteSuggestions} from '/shared/social.js';
import {CHAT_CHANNELS,parseChat} from '/shared/chat.js';
export class SocialChat{
 constructor({input,list,channelSelect,getPlayer,onSend,onOpen,onBook,persistent=false}){Object.assign(this,{input,list,channelSelect,getPlayer,onSend,onOpen,onBook,persistent});this.index=0;this.matches=[];this.channel='say';
  if(channelSelect){for(const [id,c]of Object.entries(CHAT_CHANNELS)){if(c.direct)continue;const option=document.createElement('option');option.value=id;option.textContent=`${c.name} (${c.command})${c.unavailable?' · Coming later':''}`;option.disabled=!!c.unavailable;channelSelect.append(option);}channelSelect.onchange=()=>this.setChannel(channelSelect.value);channelSelect.title='/say: 35 paces · /yell: 120 paces · /1 or /z: zone · /p: party · /w name: whisper · /friend name';}this.setChannel('say');
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';
  input.addEventListener('input',()=>{this.index=0;this.render();});
  input.addEventListener('focus',()=>this.onOpen());
  input.addEventListener('keydown',e=>this.key(e));input.addEventListener('blur',()=>{this.hideSuggestions();if(!this.persistent)input.classList.add('hidden');});
 }
 setChannel(id){if(!Object.hasOwn(CHAT_CHANNELS,id)||(CHAT_CHANNELS[id].unavailable||CHAT_CHANNELS[id].direct))return;this.channel=id;if(this.channelSelect)this.channelSelect.value=id;const c=CHAT_CHANNELS[id];this.input.placeholder=`${c.name}${c.range?` · ${c.range} paces`:''} — / emotes, /w name whisper, /z zone`;this.input.dataset.channel=id;}
 open(prefix){this.onOpen();this.input.classList.remove('hidden');if(typeof prefix==='string'||!this.persistent)this.input.value=prefix||'';this.input.focus();this.index=0;this.render();}
 hideSuggestions(){this.list.replaceChildren();this.list.classList.add('hidden');this.input.setAttribute('aria-expanded','false');this.input.removeAttribute('aria-activedescendant');}
 close(){this.input.value='';this.input.blur();if(!this.persistent)this.input.classList.add('hidden');this.hideSuggestions();}
 render(){const p=this.getPlayer();const query=this.input.value.match(/^\/([a-z]*)$/i),commands=[['whisper','✉','Whisper to a player'],['friend','＋','Add a friend'],['friends','☷','Open friends'],['say','○','Speak nearby'],['yell','◉','Call out nearby'],['zone','◇','Speak throughout your zone'],['party','♧','Speak to your party']];this.matches=[...(query?commands.filter(([id])=>id.startsWith(query[1].toLowerCase())).map(([id,glyph,name])=>({id,glyph,name,completion:`/${id} `})):[]),...(p?emoteSuggestions(p,this.input.value):[])];if(!this.matches.length){this.hideSuggestions();return;}this.index=Math.min(this.index,this.matches.length-1);this.list.replaceChildren();this.list.classList.remove('hidden');this.input.setAttribute('aria-expanded','true');
  for(const [i,e]of this.matches.entries()){const b=document.createElement('button');b.type='button';b.id=`chat-emote-${e.id}`;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===this.index));b.className=i===this.index?'selected':'';const name=document.createElement('strong'),detail=document.createElement('span');name.textContent=`${e.glyph} /${e.id}`;detail.textContent=e.name;b.append(name,detail);b.onpointerdown=event=>{event.preventDefault();this.index=i;this.complete();};this.list.append(b);}
  const active=this.list.children[this.index];this.input.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});
 }
 complete(){const e=this.matches[this.index];if(e){this.input.value=e.completion||`/${e.id}`;this.hideSuggestions();}}
 key(e){e.stopPropagation();
  if(['ArrowUp','ArrowDown','Tab'].includes(e.key)&&this.matches.length&&!this.list.classList.contains('hidden')){e.preventDefault();if(e.key==='Tab')this.complete();else{this.index=(this.index+(e.key==='ArrowDown'?1:-1)+this.matches.length)%this.matches.length;this.render();}return;}
  if(e.key==='Escape'){e.preventDefault();if(this.persistent){this.input.blur();this.hideSuggestions();}else this.close();return;}
  if(e.key==='Enter'){e.preventDefault();this.submit();}
 }
 submit(){const text=this.input.value.trim(),chat=parseChat(text,this.channel);if(chat?.explicit)this.setChannel(chat.channel);if(text==='/'||text==='/emotes'||text==='/help')this.onBook();else if(text&&this.onSend(text,this.channel)===false)return;this.close();}
}
