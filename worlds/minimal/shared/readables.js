import {definition} from './definition.js';
export const READABLES=definition.readables,GATHER_READINGS={};
export const readableAvailable=(p,r)=>!!p&&!!r;
export const readingEvent=(p,r)=>({type:'reading',to:p.id,...r});
