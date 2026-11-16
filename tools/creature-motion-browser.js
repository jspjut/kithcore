import {firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,selectedWorld} from './worlds.js';
import {startTestWorld} from './testing.js';
const server=await startTestWorld(process.argv.includes('--world')?selectedWorld():'emberwild');let browser,page;const errors=[];
try{
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});browser=await firefox.launch({headless:process.env.HEADED!=='1',firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}});page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.base+'/asset-library.html');await page.waitForFunction(()=>window.assetLibraryStudio?.debug.metadata);
 const shapes=await page.evaluate(async()=>{const {EXPANSION_ASSETS}=await import('/shared/asset-library.js');return [...new Map(EXPANSION_ASSETS.filter(a=>a.category==='creature').map(a=>[a.model,a])).values()].map(a=>({id:a.id,model:a.model}));});assert.equal(shapes.length,32);
 for(const shape of shapes){await page.evaluate(id=>window.assetLibraryStudio.select(id),shape.id);for(const state of ['idle','walk']){
  await page.locator(`[data-state="${state}"]`).click();const before=await page.evaluate(()=>{const v=[];window.assetLibraryStudio.current.traverse(n=>v.push(...n.position,...n.quaternion,...n.scale));return v;});await page.waitForTimeout(150);const after=await page.evaluate(()=>{const v=[];window.assetLibraryStudio.current.traverse(n=>v.push(...n.position,...n.quaternion,...n.scale));return {values:v,errors:window.assetLibraryStudio.debug.shaderErrors};});assert.equal(after.errors,0);assert.ok(after.values.every(Number.isFinite));assert.ok(after.values.some((v,i)=>Math.abs(v-before[i])>1e-5),`${shape.model} ${state} moves in the real workshop`);
 }
 if(['serpent','mammoth','jelly','centipede','bat','snail'].includes(shape.model))await page.screenshot({path:path.join(ROOT,`test-results/motion-${shape.model}.png`)});
 }
 await page.goto(server.base+'/?debug=1');await page.locator('#name').fill('Motion Review');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);
 const live=await page.evaluate(async()=>{
  const {scene}=await import('/main.js');const {disposeExpansionAsset}=await import('/asset-library/library.js');const object=scene.creature('root_serpent');
  // Exercise the actual renderer hook, including its network animator. A dead
  // expansion actor must not keep swaying or fail its missing animator access.
  let pose={x:0,z:0,facing:0};for(let i=0;i<90;i++){pose={...pose,x:i/60*1.6};scene.animateCreature(object,pose,1/60,{hp:55,slamAt:0});}
  const animation={...object.userData.animation};scene.animateCreature(object,pose,1/60,{hp:0,slamAt:0});disposeExpansionAsset(object);return animation;
 });assert.ok(live.move>.7&&live.phase>0);await page.waitForTimeout(200);assert.deepEqual(errors,[]);
 await writeFile(path.join(ROOT,'test-results/creature-motion-results.json'),JSON.stringify({bodyShapes:32,states:['idle','walk'],realWorldRenderer:true,deadRig:true,shaderErrors:0,errors},null,2));console.log('All 32 body shapes animate in the workshop; live creature renderer passed.');
}finally{await browser?.close();await server.stop();}
