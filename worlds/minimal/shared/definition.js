import {readDefinition} from './load-data.js';
export const definition=await readDefinition(new URL('./data.json',import.meta.url));
