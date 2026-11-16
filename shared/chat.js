export const CHAT_CHANNELS={
 say:{name:'Say',command:'/say',range:35},
 yell:{name:'Yell',command:'/yell',range:120},
 general:{name:'1. General',command:'/1'},
 party:{name:'Party',command:'/p'},
 whisper:{name:'Whisper',command:'/w',direct:true},
 guild:{name:'Guild',command:'/g',unavailable:true}
};
const aliases={say:'say',s:'say',yell:'yell',y:'yell','1':'general',general:'general',z:'general',zone:'general',w:'whisper',whisper:'whisper',tell:'whisper',p:'party',party:'party',g:'guild',guild:'guild'};
export const cleanChat=text=>typeof text==='string'?text.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,200):'';
// Unknown slash commands remain available to the learned-emote parser.
export function parseChat(text,channel='say'){
 if(typeof text!=='string')return null;
 const trimmed=text.trim(),match=trimmed.match(/^\/(\w+)(?:\s+([\s\S]*))?$/);
 if(trimmed.startsWith('/')){const id=match&&Object.hasOwn(aliases,match[1].toLowerCase())?aliases[match[1].toLowerCase()]:null;return id?{channel:id,text:cleanChat(match[2]),explicit:true}:null;}
 return {channel,text:cleanChat(trimmed),explicit:false};
}
