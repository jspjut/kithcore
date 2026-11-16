import {landscapeHeight} from './landscape.js';
export const TERRAIN_SIZE=160,TERRAIN_SEGMENTS=160;
export const heightAt=landscapeHeight;
export const terrainSlope=(x,z)=>({x:(heightAt(x+.1,z)-heightAt(x-.1,z))/.2,z:(heightAt(x,z+.1)-heightAt(x,z-.1))/.2});
