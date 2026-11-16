// Authoring targets for a wider game, separate from the playable XP table.
export const PLANNED_LEVEL_CAP=100;
export const LIVE_LEVEL_CAP=3;
export const RARITIES={
  common:{id:'common',name:'Common',color:'#f1eee5',colorName:'white',rank:0,firstPlannedLevel:1},
  uncommon:{id:'uncommon',name:'Uncommon',color:'#79ca60',colorName:'green',rank:1,firstPlannedLevel:3},
  rare:{id:'rare',name:'Rare',color:'#6aa9e3',colorName:'blue',rank:2,firstPlannedLevel:25},
  epic:{id:'epic',name:'Epic',color:'#b392df',colorName:'purple',rank:3,firstPlannedLevel:60},
  legendary:{id:'legendary',name:'Legendary',color:'#ee9b48',colorName:'orange',rank:4,firstPlannedLevel:100},
  unique:{id:'unique',name:'Unique',color:'#efd15d',colorName:'gold',rank:5,firstPlannedLevel:100}
};
export const RARITY_ORDER=Object.keys(RARITIES);
export const rarityDefinition=id=>RARITIES[id]||RARITIES.common;
export const LEVELING_BANDS=[
  {id:'starter',min:1,max:10,label:'First steps',baseline:['common'],special:['uncommon'],ceiling:'uncommon',minutesPerLevel:[15,25]},
  {id:'frontier',min:11,max:24,label:'Regional adventurer',baseline:['uncommon'],special:[],ceiling:'uncommon',minutesPerLevel:[15,30]},
  {id:'journeyman',min:25,max:49,label:'Journeyman',baseline:['uncommon'],special:['rare'],ceiling:'rare',minutesPerLevel:[30,50]},
  {id:'veteran',min:50,max:69,label:'Veteran',baseline:['uncommon','rare'],special:['epic'],ceiling:'epic',minutesPerLevel:[45,70]},
  {id:'champion',min:70,max:89,label:'Regional champion',baseline:['rare'],special:['epic'],ceiling:'epic',minutesPerLevel:[60,90]},
  {id:'cap_approach',min:90,max:99,label:'Approaching the cap',baseline:['rare'],special:['epic'],ceiling:'epic',minutesPerLevel:[90,120]},
  {id:'endgame',min:100,max:100,label:'Endgame',baseline:['rare','epic'],special:['legendary','unique'],ceiling:'unique',minutesPerLevel:null}
];
export const levelingBand=level=>LEVELING_BANDS.find(b=>Number.isInteger(level)&&level>=b.min&&level<=b.max)||null;
export function rarityFitsPlannedLevel(id,level){const r=RARITIES[id],band=levelingBand(level);return !!r&&!!band&&level>=r.firstPlannedLevel&&r.rank<=RARITIES[band.ceiling].rank;}

// Bag volume advances independently of combat rarity. Only the first two tiers
// are supplied by the level 1–10 region; later sources belong to future zones.
export const BAG_PROGRESSION=[
 {id:'linen_pouch',name:'Trailside pouch',slots:6,minLevel:1},
 {id:'trail_satchel',name:'Trailkeeper’s satchel',slots:8,minLevel:3},
 {id:'journey_pack',name:'Journey pack',slots:10,minLevel:15},
 {id:'ranger_pack',name:'Ranger’s field pack',slots:12,minLevel:25},
 {id:'wayfarer_pack',name:'Wayfarer’s pack',slots:14,minLevel:35},
 {id:'surveyor_pack',name:'Surveyor’s pack',slots:16,minLevel:45},
 {id:'expedition_pack',name:'Expedition pack',slots:18,minLevel:55},
 {id:'frontier_pack',name:'Frontier pack',slots:20,minLevel:65},
 {id:'horizon_pack',name:'Horizon pack',slots:22,minLevel:75},
 {id:'farreach_pack',name:'Farreach pack',slots:24,minLevel:85},
 {id:'veteran_pack',name:'Veteran’s pack',slots:26,minLevel:95},
 {id:'worldstrider_pack',name:'Worldstrider’s pack',slots:28,minLevel:100}
];
