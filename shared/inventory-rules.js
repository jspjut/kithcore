import {EQUIPMENT_SLOTS,equipmentSlot,emptyEquipment} from './equipment-slots.js';

export function createInventoryRules({ITEMS,BAG_CAPACITY=20,BAG_EQUIP_SLOTS=4,STACK_SIZE=99}) {
function compatibleEquipmentSlots(item){const definition=typeof item==='string'?ITEMS[item]:item;return definition?.slot?EQUIPMENT_SLOTS.filter(slot=>slot.accepts.includes(definition.slot)):[];}
function canEquipInSlot(item,slot){const definition=typeof item==='string'?ITEMS[item]:item;return !!definition?.slot&&!!equipmentSlot(slot)?.accepts.includes(definition.slot);}
// Public appearance contains only modeled slots, never inventory or private gear.
const VISIBLE_EQUIPMENT_SLOTS = ['weapon','offhand','head','armor','legs','feet','shoulders','hands','waist','back'];
function visibleEquipment(equipment){return Object.fromEntries(VISIBLE_EQUIPMENT_SLOTS.map(slot=>{const id=equipment?.[slot];return [slot,ITEMS[id]?.appearance&&canEquipInSlot(id,slot)?id:null];}));}
function equippedItemCount(p,id){return EQUIPMENT_SLOTS.filter(slot=>p.equipment?.[slot.id]===id).length;}
function defaultEquipmentSlot(p,item){const slots=compatibleEquipmentSlots(item);return (slots.find(slot=>!p.equipment?.[slot.id])||slots[0])?.id||null;}
function normalizeEquipment(equipment,inventory){
  const result=emptyEquipment(),used={};
  for(const slot of EQUIPMENT_SLOTS){const id=equipment?.[slot.id];if(!id||!canEquipInSlot(id,slot.id)||(used[id]||0)>=(inventory[id]||0))continue;result[slot.id]=id;used[id]=(used[id]||0)+1;}
  return result;
}
function equipmentBonuses(p){return EQUIPMENT_SLOTS.reduce((total,slot)=>{const item=ITEMS[p.equipment?.[slot.id]];if(item&&canEquipInSlot(item,slot.id))for(const stat of ['power','armor','vitality'])total[stat]+=item[stat]||0;return total;},{power:0,armor:0,vitality:0});}
function inventoryCapacity(p){return BAG_CAPACITY+(p.bags||[]).slice(0,BAG_EQUIP_SLOTS).reduce((n,id)=>n+(ITEMS[id]?.bagSlots||0),0);}
function storedItemCount(p,id){const item=ITEMS[id];return Math.max(0,(p.inventory[id]||0)-(item?.slot?equippedItemCount(p,id):0)-(item?.bagSlots?(p.bags||[]).filter(b=>b===id).length:0));}
function bagContainers(p){
  let start=BAG_CAPACITY;return [{key:'backpack',name:'Backpack',capacity:BAG_CAPACITY,start:0,index:-1},...Array.from({length:BAG_EQUIP_SLOTS},(_,index)=>{const id=p.bags?.[index],capacity=ITEMS[id]?.bagSlots||0,result={key:`bag${index}`,name:ITEMS[id]?.name||`Empty bag slot ${index+1}`,capacity,start,index,item:id||null};start+=capacity;return result;})];
}
function bagEntries(p) {
  return Object.entries(p.inventory).flatMap(([id,owned])=>{
    const item=ITEMS[id];if(!item)return [];
    let count=storedItemCount(p,id);const entries=[];
    while(count>0){const stack=Math.min(count,item.slot||item.bagSlots?1:STACK_SIZE);entries.push({id,count:stack});count-=stack;}
    return entries;
  });
}
function canAddItem(p,id,count=1) {
  return bagEntries({...p,inventory:{...p.inventory,[id]:(p.inventory[id]||0)+count}}).length<=inventoryCapacity(p);
}

return {compatibleEquipmentSlots,canEquipInSlot,VISIBLE_EQUIPMENT_SLOTS,visibleEquipment,equippedItemCount,defaultEquipmentSlot,normalizeEquipment,equipmentBonuses,inventoryCapacity,storedItemCount,bagContainers,bagEntries,canAddItem};
}
