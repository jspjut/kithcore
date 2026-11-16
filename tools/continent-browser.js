// Disposable survey driver. The fixture command is injected ONLY into the
// assembled test runtime; it is never part of the shipped server or saves.
import {firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {startTestWorld} from './testing.js';
import {ROOT,selectedWorld} from './worlds.js';
const server=await startTestWorld(process.argv.includes('--world')?selectedWorld():'emberwild',{setupRuntime:async runtime=>{
 const file=path.join(runtime.directory,'server/world.js');let source=await readFile(file,'utf8');
 source="import {CONTINENT_ZONES as surveyZones,CONTINENT_SITES as surveySites} from '../shared/continent.js';\n"+source;
 const marker='  command(p, msg) {';assert.ok(source.includes(marker));
 source=source.replace(marker,`${marker}\n    if(msg?.type==='fixtureSurvey'){const point=[...surveyZones,...surveySites,{id:'alderhaven',x:1090,z:9}].find(v=>v.id===msg.id);if(point){this.travel.closeInteractions(p);p.transit=null;Object.assign(p,{x:point.x,z:point.z});delete p.y;settleOnSurface(p);p.mapId=zoneAt(p.x,p.z);this.resetMotion(p);}return;}`);
 await writeFile(file,source);
}});
let browser,page;const errors=[];
try{
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});
 browser=await firefox.launch({headless:process.env.HEADED!=='1',firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}});
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(server.base+'/?debug=1');await page.locator('#name').fill('Continent Survey');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);
 const zones=await page.evaluate(async()=>{const {CONTINENT_ZONES}=await import('/shared/continent.js');return CONTINENT_ZONES.map(z=>({id:z.id,kind:z.kind,route:z.route,band:z.band}));});
 const warp=async id=>{await page.evaluate(async id=>{const {send}=await import('/main.js');send({type:'fixtureSurvey',id});},id);await page.waitForFunction(id=>window.mmoDebug.state.self.mapId===id.replace(/-(landmark|grounds|ruins)$/,''),id);await page.waitForTimeout(100);};
 for(const zone of zones){
  await warp(zone.id);await page.evaluate(async()=>{const {scene}=await import('/main.js');scene.zoom=100;scene.pitch=.6;scene.yaw=.65;});await page.waitForTimeout(150);
  const stats=await page.evaluate(async()=>{const {scene}=await import('/main.js');return {map:window.mmoDebug.state.self.mapId,shaderErrors:window.mmoDebug.environment.shaderErrors,terrain:window.mmoDebug.terrain,scenery:scene.continentScene.debug(),calls:window.mmoDebug.render.calls,buildings:scene.buildings.entries.filter(e=>e.definition.continent).length};});
  assert.equal(stats.shaderErrors,0);assert.ok(stats.calls>0);assert.ok(stats.terrain.tiles<=361);assert.ok(stats.scenery.chunks<=25);assert.ok(stats.buildings<90);
  if(zone.kind==='capital'||zone.kind==='max-level'||zone.band===0){await page.screenshot({path:path.join(ROOT,`test-results/continent-${zone.id}.png`)});}
  console.log(`Surveyed ${zone.id}: ${stats.scenery.chunks} scenery chunks, ${stats.buildings} nearby buildings.`);
 }
 for(const zone of zones.filter(z=>z.kind==='max-level')){
  await warp(`${zone.id}-landmark`);await page.waitForTimeout(250);await page.screenshot({path:path.join(ROOT,`test-results/continent-${zone.id}-landmark.png`)});
 }
 await warp('hazelwash');await warp('alderhaven');await page.locator('#travel-button').click();await page.locator('#travel-search').fill('hazelwash');await page.locator('[data-flight-result="hazelwash"]').click();await page.locator('[data-travel-to="hazelwash"][data-mode="flight"]').click();await page.waitForFunction(()=>!!window.mmoDebug.state.self.transit);await page.waitForTimeout(1500);await page.screenshot({path:path.join(ROOT,'test-results/continent-flight.png')});assert.ok(await page.evaluate(()=>window.mmoDebug.state.self.transit.remaining>0));await page.waitForFunction(()=>!window.mmoDebug.state.self.transit&&window.mmoDebug.state.self.mapId==='hazelwash');
 await page.locator('#window-travel .window-close').click();await warp('sylvarin');await warp('alderhaven');await page.locator('#travel-button').click();await page.locator('#travel-search').fill('sylvarin');await page.locator('[data-flight-result="sylvarin"]').click();await page.locator('[data-travel-to="sylvarin"][data-mode="portal"]').click();await page.waitForFunction(()=>window.mmoDebug.state.self.mapId==='sylvarin');await page.locator('#window-travel .window-close').click();
 await page.keyboard.press('KeyM');await page.locator('#zone-map[data-map-id="sylvarin"]').waitFor();await page.locator('#zone-map').click({button:'right'});await page.locator('#zone-map[data-map-id="greenward"]').waitFor();await page.screenshot({path:path.join(ROOT,'test-results/continent-atlas.png')});await page.keyboard.press('Escape');
 const unlocks=await page.evaluate(()=>window.mmoDebug.state.self.travelUnlocks);await page.locator('#main-menu-button').click();await page.locator('[data-logout]').click();await page.locator('#login').waitFor();await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self.mapId==='sylvarin');assert.deepEqual(await page.evaluate(()=>window.mmoDebug.state.self.travelUnlocks),unlocks);
 assert.deepEqual([...new Set(errors)],[]);await writeFile(path.join(ROOT,'test-results/continent-browser-results.json'),JSON.stringify({surveyed:zones.length,streamedScenery:true,renderedFourCapitalsAndTenFrontiers:true,realFlight:true,realPortal:true,travelUnlocksRestored:true,atlas:true,errors},null,2));console.log('Continent browser survey passed.');
}catch(error){console.error(errors,server.logs);await page?.screenshot({path:path.join(ROOT,'test-results/continent-browser-failure.png')}).catch(()=>{});throw error;}
finally{await browser?.close();await server.stop();}
