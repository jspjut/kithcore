import {randomUUID} from 'node:crypto';
import {MAILBOXES,MAIL_LIMIT,FRIEND_LIMIT,MAIL_ATTACHMENTS,mailText} from '../shared/mail.js';
import {ITEMS,STACK_SIZE,storedItemCount,bagEntries,inventoryCapacity} from '../shared/content.js';
import {lineOfSight} from '../shared/props.js';
const fail=text=>{throw Error(text);};
const record=(data,id)=>{data.correspondence??={};return data.correspondence[id]??={friends:[],letters:[]};};
const profileByName=(data,name)=>Object.entries(data.profiles).find(([,p])=>p.name.toLowerCase()===name.toLowerCase());
export class Correspondence{
 constructor(world,store){this.world=world;this.store=store;}
 access(p){return p.hp>0&&MAILBOXES.find(b=>b.id===p.mailboxId&&Math.hypot(p.x-b.x,p.z-b.z)<=4.8&&lineOfSight(p,b));}
 directory(){if(this.directoryData!==this.store.data){this.directoryData=this.store.data;this.byId=new Map(Object.values(this.store.data.profiles).map(v=>[v.id,v]));}return this.byId;}
 characterNames(){return [...this.directory().values()];}
 summary(p){
  const r=this.store.data.correspondence?.[p.id],byId=this.directory();
  return {friends:(r?.friends||[]).map(id=>{const v=this.world.players.get(id)||byId.get(id);return v?{id,name:v.name,online:this.world.players.has(id),level:v.level,mapId:this.world.players.has(id)?v.mapId:null}:null;}).filter(Boolean),unreadMail:(r?.letters||[]).filter(m=>!m.read).length,mailbox:this.access(p)?.id||null};
 }
 view(p,extra={}){if(!this.access(p))return;const letters=this.store.data.correspondence?.[p.id]?.letters||[];this.world.events.push({type:'mailbox',to:p.id,mailbox:p.mailboxId,letters:structuredClone(letters),...extra});}
 open(p,id){p.mailboxId=id;if(!this.access(p)){p.mailboxId=null;return this.world.notify(p,'Move closer to a mailbox.');}this.view(p);}
 async handle(p,msg,key){
  if(msg.type==='mail'&&msg.action==='close'){p.mailboxId=null;return;}
  if(msg.type==='mail'&&msg.action==='open'){this.open(p,msg.id);return;}
  if(p.storageBusy)return;
  p.storageBusy=true;let committedInventory;
  try{
   await this.store.transaction(data=>{
    if(!data.profiles[key]||data.profiles[key].id!==p.id)fail('This character is no longer available.');
    const r=record(data,p.id);
    if(msg.type==='friend'){
     const found=msg.id?Object.entries(data.profiles).find(([,v])=>v.id===msg.id):profileByName(data,mailText(msg.name,18));
     if(!found)fail('No character with that name exists.');const other=found[1];
     if(other.id===p.id)fail('Choose another adventurer to add as a friend.');
     if(msg.action==='remove'){r.friends=r.friends.filter(id=>id!==other.id);return;}
     if(msg.action!=='add')fail('Choose Add friend or Remove friend.');
     if(r.friends.includes(other.id))fail('That adventurer is already on your friends list.');
     if(r.friends.length>=FRIEND_LIMIT)fail('Your friends list is full.');r.friends.push(other.id);return;
    }
    if(!this.access(p))fail('Visit a mailbox to send or collect letters.');
    if(msg.action==='send'){
     const requestId=mailText(msg.requestId,80);if(requestId&&(r.sentRequests||[]).includes(requestId))fail('That letter was already delivered.');
     const found=profileByName(data,mailText(msg.name,18));if(!found)fail('No character with that name exists.');const recipient=found[1];
     const dest=record(data,recipient.id);if(dest.letters.length>=MAIL_LIMIT)fail('That mailbox is full. Ask the recipient to clear some letters.');
     const subject=mailText(msg.subject,80),body=mailText(msg.body,2000);if(!subject)fail('Give your letter a subject.');
     const attachments=msg.attachments??[];if(!Array.isArray(attachments)||attachments.length>MAIL_ATTACHMENTS)fail('Attach at most six stacks.');
     const inventory={...p.inventory},temporary={...p,inventory};
     for(const a of attachments){
      const item=Object.hasOwn(ITEMS,a?.item)&&ITEMS[a.item];
      if(!item||item.quest||item.npcOnly||!Number.isSafeInteger(a.count)||a.count<1||a.count>STACK_SIZE||(item.slot||item.bagSlots)&&a.count!==1)fail('Choose a valid unequipped item and stack amount. Quest items cannot be mailed.');
      if(storedItemCount(temporary,a.item)<a.count)fail('An attached item is no longer available in your bags.');
      inventory[a.item]-=a.count;if(!inventory[a.item])delete inventory[a.item];
     }
     dest.letters.push({id:randomUUID(),senderId:p.id,sender:p.name,subject,body,sentAt:Date.now(),read:false,attachments:attachments.map(a=>({item:a.item,count:a.count}))});
     if(requestId)r.sentRequests=[...(r.sentRequests||[]),requestId].slice(-100);
     data.profiles[key]={...this.world.save(p),inventory};committedInventory=inventory;return;
    }
    const letter=r.letters.find(m=>m.id===msg.id);if(!letter)fail('That letter is no longer in your mailbox.');
    if(msg.action==='read'){letter.read=true;return;}
    if(msg.action==='delete'){if(letter.attachments.length)fail('Collect the attached items before deleting this letter.');r.letters=r.letters.filter(m=>m.id!==letter.id);return;}
    if(msg.action==='claim'){
     if(!letter.attachments.length)fail('These attachments have already been collected.');
     const inventory={...p.inventory};for(const a of letter.attachments){if(!Number.isSafeInteger((inventory[a.item]||0)+a.count))fail('That stack cannot hold more items.');inventory[a.item]=(inventory[a.item]||0)+a.count;}
     if(bagEntries({...p,inventory}).length>inventoryCapacity(p))fail('Make room in your bags before collecting these attachments.');
     letter.attachments=[];letter.read=true;data.profiles[key]={...this.world.save(p),inventory};committedInventory=inventory;return;
    }
    fail('Choose a valid mailbox action.');
   },()=>{if(committedInventory)p.inventory=committedInventory;});
   if(msg.type==='friend')this.world.notify(p,msg.action==='remove'?'Friend removed.':'Friend added.','good');
   else{if(msg.action==='send'){const other=[...this.world.players.values()].find(v=>v.name.toLowerCase()===mailText(msg.name,18).toLowerCase());if(other&&other!==p)this.view(other);}this.view(p,{sent:msg.action==='send'});if(msg.action==='send')this.world.notify(p,'Letter delivered.','good');}
  }catch(e){this.world.notify(p,e.code?'Could not save this action. Your items have not moved.':e.message);}
  finally{p.storageBusy=false;}
 }
}
