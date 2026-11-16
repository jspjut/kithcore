// Disposable fixtures only; the production protocol never gains teleport commands.
import {firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {startTestWorld} from './testing.js';
import {ROOT,selectedWorld} from './worlds.js';
const server=await startTestWorld(process.argv.includes('--world')?selectedWorld():'emberwild',{setupRuntime:async runtime=>{
 const file=path.join(runtime.directory,'server/world.js');let source=await readFile(file,'utf8');
 source="import {WAYPOINTS as surveyInns} from '../shared/travel.js';\nimport {TRAVEL_NODES as surveyStops} from '../shared/travel-network.js';\n"+source;
 source=source.replace('  command(p, msg) {',`  command(p, msg) {\n    if(msg?.type==='fixtureInn'){const point=[...surveyInns,...surveyStops].find(v=>v.id===msg.id);if(point){this.travel.closeInteractions(p);p.transit=null;Object.assign(p,{x:point.x,z:point.z});delete p.y;settleOnSurface(p);p.mapId=zoneAt(p.x,p.z);this.resetMotion(p);}return;}`);await writeFile(file,source);
}});
let browser,page;const errors=[];
try{
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});browser=await firefox.launch({headless:process.env.HEADED!=='1',firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.base+'/?debug=1');await page.locator('#name').fill('Hearth Survey');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);
 const inns=await page.evaluate(async()=>(await import('/shared/continent-buildings.js')).CONTINENT_INNS);
 const warp=async id=>{await page.bringToFront();await page.evaluate(async id=>(await import('/main.js')).send({type:'fixtureInn',id}),id);await page.waitForTimeout(1700);await page.waitForFunction(()=>window.mmoDebug?.render?.calls>0);};
 for(const id of ['hazelwash','cloudrest','pearlshoal','sylvarin']){const inn=inns.find(i=>i.mapId===id);await warp(inn.id);await page.evaluate(async()=>{const {scene}=await import('/main.js');scene.zoom=100;scene.pitch=.65;scene.yaw=.8;});await page.waitForTimeout(600);await page.screenshot({path:path.join(ROOT,`test-results/settlement-${id}.png`)});}
 const inn=inns.find(i=>i.mapId==='hazelwash');await warp('hazelwash');await warp(inn.id);await page.locator('#travel-button').click();await page.locator('[data-bind-hearth]').click();await page.waitForFunction(id=>window.mmoDebug?.state?.self?.waypointId===id,inn.id);await page.screenshot({path:path.join(ROOT,'test-results/settlement-inn-travel.png')});
 await page.locator('#travel-search').fill('hazelwash');await page.locator('[data-flight-result="hazelwash"]').click();await page.locator('[data-travel-to="hazelwash"][data-mode="flight"]').click();await page.waitForFunction(()=>!!window.mmoDebug.state.self.transit);await page.waitForFunction(()=>!window.mmoDebug.state.self.transit);await page.locator('#window-travel .window-close').click();await page.evaluate(async()=>(await import('/main.js')).send({type:'skill',skill:'recall',requestId:1}));await page.waitForFunction(()=>!!window.mmoDebug.state.self.casting);await page.waitForFunction(({x,z})=>Math.hypot(window.mmoDebug.state.self.x-x,window.mmoDebug.state.self.z-z)<.1,inn);
 await page.keyboard.press('KeyM');await page.locator('#zone-map').waitFor();const services=await page.evaluate(async()=>(await import('/shared/atlas.js')).ATLAS_MAPS.hazelwash.services);assert.ok(services.some(s=>s.id===inn.id&&s.type==='inn'));const badge=services.find(s=>s.id===inn.id),box=await page.locator('#zone-map').boundingBox();await page.mouse.move(box.x+badge.x/1000*box.width,box.y+badge.y/720*box.height);await page.locator('#map-marker-tooltip:not(.hidden)').waitFor();assert.ok((await page.locator('#map-marker-tooltip').textContent()).includes(inn.name));await page.screenshot({path:path.join(ROOT,'test-results/settlement-map-services.png')});await page.keyboard.press('Escape');
 await page.locator('#main-menu-button').click();await page.locator('[data-logout]').click();await page.locator('#login').waitFor();await page.locator('#join').click();await page.waitForFunction(id=>window.mmoDebug?.state?.self?.waypointId===id,inn.id);assert.ok(await page.evaluate(id=>window.mmoDebug.state.self.travelUnlocks.includes(id+'-flight'),inn.id));
 assert.deepEqual(errors,[]);console.log('Settlements render; inn binding, paired flight, recall, map services and persistence passed.');
}catch(error){console.error(errors,server.logs);await page?.screenshot({path:path.join(ROOT,'test-results/settlements-browser-failure.png')}).catch(()=>{});throw error;}finally{await browser?.close();await server.stop();}
