import {WORLD_INFO} from './world-info.js';

// The selected world controls its browser identity/preferences namespace.
// Existing worlds can retain their historical keys through storagePrefix.
export const storageKey=name=>`${WORLD_INFO.storagePrefix}-${name}`;
