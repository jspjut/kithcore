import {firefox} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {ROOT,selectedWorld} from './worlds.js';
import {startTestWorld} from './testing.js';
import {bindWorldState} from '../server/world-state.js';
const fixtures={};let browser;const errors=[];
const server=await startTestWorld(process.argv.includes('--world')?selectedWorld():'emberwild',{async setupRuntime(runtime,data){
 await bindWorldState(data,runtime.manifest);const {World}=await import(pathToFileURL(path.join(runtime.directory,'server/world.js')));const w=new World(),profiles={};
 for(const classId of ['dawnwarden','arcanist','pathfinder','stormcaller','companion']){const p=w.addPlayer(classId==='companion'?'Test Companion':`Test ${classId}`,{classId:classId==='companion'?'dawnwarden':classId,xp:9800,hp:40});p.x=0;p.z=32;if(classId==='pathfinder'){p.x=w.enemies[0].x;p.z=w.enemies[0].z+10;}const token=randomBytes(32).toString('hex');profiles[token]=w.save(p);fixtures[classId]={token,name:p.name,id:p.id};}
 await writeFile(path.join(data,'characters.json'),JSON.stringify(profiles),{mode:0o600});
}});
try{
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});browser=await firefox.launch({headless:process.env.HEADED!=='1',firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}});
 async function join(classId){const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(profile=>{localStorage.setItem('emberwild-character',JSON.stringify(profile));window.classEffects=[];const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.type==='effect')window.classEffects.push(m);});}};},fixtures[classId]);const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.goto(server.base+'/?debug=1');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);console.log('Joined '+classId);return page;}
 const companion=await join('companion'),pages={};
 const cast=async(page,skill,target)=>page.evaluate(async({skill,target})=>{const {send}=await import('/main.js');send({type:'target',id:target,passive:true});send({type:'skill',skill});},{skill,target});
 for(const classId of ['dawnwarden','arcanist','pathfinder','stormcaller']){
  const page=await join(classId);assert.equal(await page.evaluate(()=>window.mmoDebug.state.self.classId),classId);await page.keyboard.press('KeyP');await page.screenshot({path:path.join(ROOT,`test-results/class-${classId}.png`)});await page.keyboard.press('Escape');
  if(classId==='dawnwarden'){await cast(page,'mend',fixtures.companion.id);await page.waitForFunction(id=>window.classEffects.some(e=>e.kind==='heal'&&e.source===id&&e.target===id),fixtures.dawnwarden.id);}
  if(classId==='arcanist'){await cast(page,'sigil',fixtures.companion.id);await page.waitForFunction(id=>window.classEffects.some(e=>e.kind==='ward'&&e.source===id&&e.target===id),fixtures.arcanist.id);}
  if(classId==='pathfinder'){
   await page.evaluate(async()=>{const {scene}=await import('/main.js');const until=performance.now()+5000;function watch(){if(scene.effects.some(e=>e.projectile&&e.object.isGroup))window.sawArrow=true;if(performance.now()<until)requestAnimationFrame(watch);}watch();});const target=await page.evaluate(()=>window.mmoDebug.state.enemies.find(e=>e.type==='nibbler'&&e.hp>0).id);await cast(page,'quickshot',target);await page.waitForFunction(()=>window.sawArrow===true);
  }
  if(classId==='stormcaller')pages.stormcaller=page;else await page.context().close();console.log('Checked '+classId);
 }
 const healer=pages.stormcaller;await cast(healer,'rainmend',fixtures.companion.id);await healer.waitForFunction(ids=>window.classEffects.some(e=>e.kind==='heal'&&e.source===ids[0]&&e.target===ids[1]),[fixtures.stormcaller.id,fixtures.companion.id]);
 await healer.evaluate(async id=>(await import('/main.js')).send({type:'party',action:'invite',id}),fixtures.companion.id);await companion.locator('#party-accept').click();await healer.waitForFunction(()=>!!window.mmoDebug.state.party);await healer.evaluate(()=>window.classEffects=[]);await cast(healer,'thunder',null);await healer.waitForFunction(ids=>window.classEffects.some(e=>e.kind==='heal'&&e.source===ids[0]&&e.target===ids[1]),[fixtures.stormcaller.id,fixtures.companion.id]);
 await healer.waitForTimeout(1600);await cast(healer,'stoneguard',fixtures.companion.id);await companion.waitForFunction(()=>window.mmoDebug.state.self.shield>0);
 for(const page of Object.values(pages))assert.equal(await page.evaluate(()=>window.mmoDebug.environment.shaderErrors),0);assert.deepEqual(errors,[]);await writeFile(path.join(ROOT,'test-results/class-design-results.json'),JSON.stringify({classes:4,personalRecovery:true,mageBarrier:true,friendlyHealing:true,partyHealing:true,allyShield:true,bowArrow:true,errors},null,2));console.log('Four class spellbooks, personal recovery, healer support and bow arrows passed in real browsers.');
}catch(error){console.error(error,server.logs);throw error;}finally{await browser?.close();await server.stop();}
