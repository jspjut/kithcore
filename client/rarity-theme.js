import {RARITIES} from '../shared/progression.js';
export function applyRarityTheme(){for(const r of Object.values(RARITIES))document.documentElement.style.setProperty(`--rarity-${r.id}`,r.color);}
