import {interestedIn} from '../shared/zone-regions.js';
import {CHAT_CHANNELS,parseChat,cleanChat} from '../shared/chat.js';
export class ChatSystem{
 constructor(world){this.world=world;}
 reject(p,text,msg){this.world.notify(p,text);this.world.events.push({type:'chatRejected',to:p.id,text,attempt:cleanChat(msg.text),whisperTo:typeof msg.whisperTo==='string'?msg.whisperTo.trim().slice(0,18):null});}
 handle(p,msg){
  const direct=typeof msg.whisperTo==='string',chat=direct?{channel:'whisper',text:cleanChat(msg.text)}:parseChat(msg.text,msg.channel||'say');if(!chat)return false;
  const w=this.world,definition=Object.hasOwn(CHAT_CHANNELS,chat.channel)&&CHAT_CHANNELS[chat.channel];
  if(!definition){w.notify(p,'Unknown chat channel. Use /say, /yell, /1 or /p.');return true;}
  if(definition.unavailable){w.notify(p,'Guild chat will be available when guilds are implemented. Use /p for your party.');return true;}
  const party=chat.channel==='party'&&w.parties.get(p.partyId);
  if(chat.channel==='party'&&!party?.members.includes(p.id)){w.notify(p,'You are not in a party. Select a player and choose Invite to party.');return true;}
  if(!chat.text){if(chat.channel==='whisper')w.notify(p,'Use /w playername message. Names with spaces can be typed in full.');return true;}
  if(chat.channel==='whisper'){
   const named=[...(w.correspondence?.characterNames()||[]),...w.players.values()].sort((a,b)=>b.name.length-a.name.length).find(v=>direct?v.name.toLowerCase()===msg.whisperTo.trim().toLowerCase():chat.text.toLowerCase().startsWith(v.name.toLowerCase()+' ')),other=named&&w.players.get(named.id);
   if(!other){this.reject(p,'That player is not online, or no message was entered. Send offline letters at a mailbox.',msg);return true;}
   if(w.time-(p.lastChat??-100)<1){this.reject(p,'Please wait a moment before speaking again.',msg);return true;}p.lastChat=w.time;
   const text=direct?chat.text:chat.text.slice(other.name.length).trim();if(!text)return true;
   w.events.push({type:'chat',name:p.name,source:p.id,target:other.id,targetName:other.name,text,channel:'whisper',recipients:[...new Set([p.id,other.id])]});return true;
  }
  if(w.time-(p.lastChat??-100)<1){this.reject(p,'Please wait a moment before speaking again.',msg);return true;}p.lastChat=w.time;
  const recipients=[...w.players.values()].filter(other=>chat.channel==='party'?party.members.includes(other.id):chat.channel==='general'?(other.mapId||'cinderwood')===(p.mapId||'cinderwood'):(interestedIn(p,other)||interestedIn(other,p))&&Math.hypot(other.x-p.x,other.z-p.z)<=definition.range).map(other=>other.id);
  w.events.push({type:'chat',name:p.name,source:p.id,text:chat.text,channel:chat.channel,recipients});
  if(chat.channel==='say')w.social.hearSay(p,chat.text);
  return true;
 }
}
