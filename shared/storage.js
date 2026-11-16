import {ITEMS,STACK_SIZE,bagEntries,storedItemCount,inventoryCapacity} from './content.js';

export const BANK_CAPACITY=28;
export const bankEntries=p=>bagEntries({inventory:p.bank||{},equipment:{},bags:[]});
export function normalizeBank(value){
 return Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).filter(([id,count])=>Object.hasOwn(ITEMS,id)&&!ITEMS[id].quest&&Number.isSafeInteger(count)&&count>0));
}
// Calculate both sides before committing either: full storage or invalid input
// must never debit an item, duplicate it or detach an equipped copy.
export function transferBankItem(p,action,id,count=1){
 if(!['deposit','withdraw'].includes(action)||typeof id!=='string'||!Object.hasOwn(ITEMS,id)||!Number.isSafeInteger(count)||count<1||count>STACK_SIZE)return {error:'Choose a valid item and stack amount.'};
 const item=ITEMS[id];if(item.quest)return {error:'Quest items must stay in your bags.'};
 const available=action==='deposit'?storedItemCount(p,id):(p.bank[id]||0);
 if(!Number.isSafeInteger(available)||available<=0)return {error:'That item is not available in this storage.'};
 const amount=Math.min(count,available,item.slot||item.bagSlots?1:STACK_SIZE),inventory={...p.inventory},bank={...p.bank},source=action==='deposit'?inventory:bank,destination=action==='deposit'?bank:inventory;
 if(!Number.isSafeInteger((destination[id]||0)+amount))return {error:'That stack cannot hold more items.'};
 source[id]-=amount;if(source[id]===0)delete source[id];destination[id]=(destination[id]||0)+amount;
 if(action==='deposit'&&bankEntries({bank}).length>BANK_CAPACITY)return {error:'Your bank is full.'};
 if(action==='withdraw'&&bagEntries({...p,inventory}).length>inventoryCapacity(p))return {error:'Your bags are full.'};
 p.inventory=inventory;p.bank=bank;return {amount};
}
