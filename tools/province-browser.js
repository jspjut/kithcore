// Survey real passes in a disposable runtime; fixture commands are never shipped.
import {firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {startTestWorld} from './testing.js';
import {ROOT,selectedWorld} from './worlds.js';
const server=await startTestWorld(process.argv.includes('--world')?selectedWorld():'emberwild',{setupRuntime:async runtime=>{
 const file=path.join(runtime.directory,'server/world.js');let source=await readFile(file,'utf8');
 source="import {roadCrossings as surveyCrossings} from '../shared/continent-atlas.js';\nimport {CONTINENT_ZONES as surveyZones} from '../shared/continent.js';\n"+source;
 source=source.replace('  command(p, msg) {',`  command(p, msg) {\n    if(msg?.type==='fixturePass'){const point=surveyZones.flatMap(z=>surveyCrossings(z.id)).find(c=>c.kind===msg.kind&&c.x>1400);if(point){Object.assign(p,{x:point.x,z:point.z,transit:null});delete p.y;settleOnSurface(p);p.mapId=zoneAt(p.x,p.z);this.resetMotion(p);}return;}`);await writeFile(file,source);
}});
let browser,page;const errors=[];
try{
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});browser=await firefox.launch({headless:process.env.HEADED!=='1',firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.base+'/?debug=1');await page.locator('#name').fill('Boundary Survey');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);
 for(const kind of ['roots','ridge','ice','wall','crevasse','channel']){
  await page.evaluate(async kind=>{const {send,scene}=await import('/main.js');scene.zoom=90;scene.pitch=.65;send({type:'fixturePass',kind});},kind);
  await page.waitForTimeout(1700);
  const stats=await page.evaluate(async()=>{const {scene}=await import('/main.js');const {groundWalkable}=await import('/shared/props.js'),p=window.mmoDebug.state.self;return {map:p.mapId,x:p.x,z:p.z,walkable:groundWalkable(p.x,p.z),divides:[...scene.continentScene.chunks.values()].reduce((sum,g)=>sum+g.children.reduce((n,m)=>n+(m.count||0),0),0),shaderErrors:window.mmoDebug.environment.shaderErrors};});assert.ok(stats.walkable);assert.ok(stats.divides>20);assert.equal(stats.shaderErrors,0);
  await page.screenshot({path:path.join(ROOT,`test-results/province-pass-${kind}.png`)});console.log(kind,stats);
 }
 assert.deepEqual(errors,[]);console.log('Six physical boundary types render and passes are walkable.');
}finally{await browser?.close();await server.stop();}
