// Standard RPG equipment positions used by runtime API 1.
export const EQUIPMENT_SLOTS = [
  {id:'head',name:'Head',icon:'head',side:'left',accepts:['head'],later:true},
  {id:'neck',name:'Neck',icon:'neck',side:'left',accepts:['neck'],later:true},
  {id:'shoulders',name:'Shoulders',icon:'shoulders',side:'left',accepts:['shoulders'],later:true},
  {id:'back',name:'Back',icon:'back',side:'left',accepts:['back']},
  {id:'armor',name:'Chest',icon:'armor',side:'left',accepts:['armor','chest'],starter:true},
  {id:'shirt',name:'Shirt',icon:'shirt',side:'left',accepts:['shirt']},
  {id:'tabard',name:'Tabard',icon:'tabard',side:'left',accepts:['tabard'],later:true},
  {id:'wrists',name:'Wrists',icon:'wrists',side:'left',accepts:['wrists']},
  {id:'hands',name:'Hands',icon:'hands',side:'right',accepts:['hands']},
  {id:'waist',name:'Waist',icon:'waist',side:'right',accepts:['waist']},
  {id:'legs',name:'Legs',icon:'legs',side:'right',accepts:['legs']},
  {id:'feet',name:'Feet',icon:'feet',side:'right',accepts:['feet']},
  {id:'ring1',name:'Ring 1',icon:'ring',side:'right',accepts:['ring'],later:true},
  {id:'ring2',name:'Ring 2',icon:'ring',side:'right',accepts:['ring'],later:true},
  {id:'charm',name:'Trinket 1',icon:'charm',side:'right',accepts:['charm','trinket'],starter:true},
  {id:'trinket2',name:'Trinket 2',icon:'charm',side:'right',accepts:['charm','trinket'],later:true},
  {id:'weapon',name:'Main hand',icon:'sword',side:'bottom',accepts:['weapon'],starter:true},
  {id:'offhand',name:'Off hand',icon:'offhand',side:'bottom',accepts:['offhand']},
  {id:'relic',name:'Relic',icon:'relic',side:'bottom',accepts:['relic'],later:true}
];
const equipmentById = new Map(EQUIPMENT_SLOTS.map(slot=>[slot.id,slot]));
export const equipmentSlot = id => equipmentById.get(id);
export const emptyEquipment = () => Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot.id,null]));
