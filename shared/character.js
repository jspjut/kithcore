export const CHARACTER_LOOKS={
  hearth:{name:'Hearth',skin:'#d8b18a',hair:'#4a473c',cloth:'#8c8874'},
  ash:{name:'Ash',skin:'#b77f59',hair:'#d2c4a5',cloth:'#76808a'},
  grove:{name:'Grove',skin:'#78523f',hair:'#292e2b',cloth:'#7a8b69'},
  dawn:{name:'Dawn',skin:'#edc4a1',hair:'#9b5035',cloth:'#a48a6c'}
};
export const characterLook=id=>typeof id==='string'&&Object.hasOwn(CHARACTER_LOOKS,id)?id:'hearth';

export const SKIN_TONES={warm:{name:'Warm',color:'#d8b18a'},pearl:{name:'Pearl',color:'#edc4a1'},bronze:{name:'Bronze',color:'#b77f59'},deep:{name:'Deep',color:'#78523f'},ebony:{name:'Ebony',color:'#50382e'},tawny:{name:'Tawny',color:'#c99875'},olive:{name:'Olive',color:'#aa8d69'},rose:{name:'Rose',color:'#d7ada4'}};
export const HAIR_COLORS={umber:{name:'Umber',color:'#4a473c'},silver:{name:'Silver',color:'#d2c4a5'},raven:{name:'Raven',color:'#292e2b'},copper:{name:'Copper',color:'#9b5035'},gold:{name:'Gold',color:'#caa45a'},chestnut:{name:'Chestnut',color:'#6d3e2e'},ash:{name:'Ash',color:'#84847c'},platinum:{name:'Platinum',color:'#ece0c4'}};
export const EYE_COLORS={hazel:{name:'Hazel',color:'#6e7848'},amber:{name:'Amber',color:'#bd8d45'},blue:{name:'Blue',color:'#6f9eb3'},green:{name:'Green',color:'#4c8c70'},brown:{name:'Brown',color:'#644631'}};
export const HAIR_STYLES={cropped:{name:'Cropped'},swept:{name:'Swept'},bob:{name:'Bob'},ponytail:{name:'Ponytail'},braid:{name:'Braid'},bald:{name:'Bald'}};
export const FACIAL_HAIR={none:{name:'None'},moustache:{name:'Moustache'},short:{name:'Short beard'},full:{name:'Full beard'}};
export const FACE_SHAPES={balanced:{name:'Balanced',width:1,depth:1},soft:{name:'Soft',width:.95,depth:1.02},angular:{name:'Angular',width:1.06,depth:.98}};
export const BODY_BUILDS={balanced:{name:'Balanced',width:1,depth:1},slender:{name:'Slender',width:.88,depth:.94},broad:{name:'Broad',width:1.12,depth:1.06}};
export const CUSTOMIZATION_OPTIONS={skin:SKIN_TONES,hairColor:HAIR_COLORS,hairStyle:HAIR_STYLES,facialHair:FACIAL_HAIR,eyeColor:EYE_COLORS,face:FACE_SHAPES,build:BODY_BUILDS};
export function normalizeAppearance(value,look='hearth'){
  const preset=characterLook(look),defaults={skin:{hearth:'warm',ash:'bronze',grove:'deep',dawn:'pearl'}[preset],hairColor:{hearth:'umber',ash:'silver',grove:'raven',dawn:'copper'}[preset],hairStyle:'cropped',facialHair:'none',eyeColor:'hazel',face:'balanced',build:'balanced'};
  return Object.fromEntries(Object.entries(CUSTOMIZATION_OPTIONS).map(([field,options])=>[field,typeof value?.[field]==='string'&&Object.hasOwn(options,value[field])?value[field]:defaults[field]]));
}
export function appearancePalette(appearance,look='hearth'){const a=normalizeAppearance(appearance,look);return {...CHARACTER_LOOKS[characterLook(look)],skin:SKIN_TONES[a.skin].color,hair:HAIR_COLORS[a.hairColor].color,eyes:EYE_COLORS[a.eyeColor].color};}
