// Source-built inventory art follows equipment silhouettes and authored colors.
// The same SVG generator is used for UI icons and downloadable art exports.
const shapes={
 wand:'<path d="M17 54l25-32M37 14l8-9 8 9-8 9zM43 28l10 3M34 18l-5-8"/>',
 focus:'<circle cx="32" cy="30" r="12"/><path d="M17 10v34h30V10M23 50h18M32 42v15"/>',
 sword:'<path d="M29 43V12l3-6 3 6v31M21 42h22M27 46v12h10V46"/>',
 greatsword:'<path d="M27 42V13l5-8 5 8v29M18 42h28M28 46v13h8V46"/>',
 dagger:'<path d="M29 37V21l3-11 3 11v16M23 38h18M29 41v15h6V41"/>',
 axe:'<path d="M30 10v48h5V10M35 14c17-6 23 1 21 16-8-4-14-2-21 1M29 16l-9 3v11l9 2"/>',
 hammer:'<path d="M29 28v30h7V28M12 12h40v18H12zM17 16h30v10H17"/>',
 staff:'<path d="M30 26v33h5V26M22 10l-3 11 13 8 13-8-3-11M32 7l6 9-6 9-6-9z"/>',
 spear:'<path d="M30 26v34h4V26M32 4l9 16-9 9-9-9zM24 30h16"/>',
 bow:'<path d="M20 8q40 24 0 48M20 8l9 24-9 24M12 32h39M44 27l8 5-8 5"/>',
 shield:'<path d="M12 12q20 8 40 0v20q-3 17-20 25Q15 49 12 32zM32 17v31M19 30h26"/>',
 helmet:'<path d="M12 45V28q0-19 20-19t20 19v17l-12 8V33H24v20zM14 28h36M32 12v18"/>',
 hat:'<path d="M17 38l4-18q11-9 22 0l4 18M8 39q24 16 48 0-24-12-48 0M21 30h23"/>',
 armor:'<path d="M20 10l12 5 12-5 12 12-10 10-4-5v29H22V27l-4 5L8 22zM26 17v31M38 17v31"/>',
 trousers:'<path d="M18 9h28l-2 48H33l-1-28-1 28H20zM20 17h24"/>',
 boots:'<path d="M16 10h17v29l11 5v12H10V44l6-5zM34 11h14v25l9 6v10H45M17 20h15"/>',
 pack:'<path d="M19 14q13-13 26 0v7M14 21h36v36H14zM20 28h24v13H20zM14 46h36M8 32h6v18H8M50 32h6v18h-6"/>',
 ring:'<circle cx="32" cy="37" r="16"/><path d="M23 12h18l4 9-13 9-13-9z"/>',
 charm:'<path d="M20 8q-10 22 12 28Q54 30 44 8M32 31l13 12-13 15-13-15z"/>',
 shoulders:'<path d="M8 25l15-12 9 9 9-9 15 12-5 18-15-6-4-8-4 8-15 6z"/>',
 back:'<path d="M22 10h20l12 47H10zM22 10l10 10 10-10M32 23v29"/>',
 gloves:'<path d="M18 51V23l5-4 4 8V10h6v17-19h6v21-16h6v22l6-9 5 4-9 21z"/>',
 belt:'<path d="M8 25h48v15H8zM25 21h14v23H25zM30 27h5v11h-5"/>'
};
const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{3,8}$/i.test(value)?value:fallback;
export const ITEM_ICON_MODELS=Object.keys(shapes);
export function itemIcon(item){
 const recipe=item?.appearance||{},model=shapes[recipe.model]?recipe.model:({armor:'armor',head:'helmet',legs:'trousers',feet:'boots',hands:'gloves',back:'back',shoulders:'shoulders',waist:'belt',wrist:'gloves',neck:'charm',charm:'charm',ring1:'ring',ring2:'ring',trinket1:'charm',trinket2:'charm',offhand:'shield'})[item?.slot]||'armor';
 return `<svg xmlns="http://www.w3.org/2000/svg" class="game-icon" aria-hidden="true" viewBox="0 0 64 64" data-item-icon="${model}"><rect x="2" y="2" width="60" height="60" rx="9" fill="#24332d"/><g fill="${color(recipe.main,'#9eafad')}" stroke="${color(recipe.trim,'#e1c58d')}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${shapes[model]}</g></svg>`;
}
