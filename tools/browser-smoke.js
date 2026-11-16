import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {firefox,chromium} from '@playwright/test';
import {ROOT} from './worlds.js';
import {startTestWorld} from './testing.js';

// An explicit TEST_URL must be a disposable Meadow server: this creates saves.
const server=process.env.TEST_URL?{base:process.env.TEST_URL,logs:'External test server',stop:async()=>{}}:await startTestWorld('minimal');
const errors=[],contexts=[];let browser;
try{
 const type=process.env.BROWSER==='chromium'?chromium:firefox;
 browser=await type.launch({headless:process.env.HEADED!=='1',...(type===firefox?{firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}}:{})});
 async function guest(name,raceId,classId){
  const context=await browser.newContext({viewport:{width:1280,height:800}});contexts.push(context);const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(server.base+'/?debug=1');await page.locator('#name').fill(name);
  assert.equal(await page.locator('[data-race-choice]').count(),2);assert.equal(await page.locator('[data-class-choice]').count(),2);
  for(const race of ['sylvren','cairnkin','brinefolk','emberkin'])assert.equal(await page.locator(`[data-race-choice="${race}"]`).count(),0);
  for(const r of ['human','harefolk'])for(const c of ['adventurer','scholar']){await page.locator(`[data-race-choice="${r}"]`).click();await page.locator(`[data-class-choice="${c}"]`).click();await page.waitForFunction(({r,c})=>{const el=document.querySelector('#character-preview');return el.dataset.raceId===r&&el.dataset.classId===c;},{r,c});}
  await page.locator(`[data-race-choice="${raceId}"]`).click();await page.locator(`[data-class-choice="${classId}"]`).click();await page.mouse.move(1100,50);await page.locator('#name').focus();await page.keyboard.press('Escape');
  await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);
  assert.equal(await page.evaluate(()=>window.mmoDebug.state.self.raceId),raceId);assert.equal(await page.evaluate(()=>window.mmoDebug.state.self.classId),classId);
  return page;
 }
 const suffix=Date.now().toString(36).slice(-5),firstName=`Browser ${suffix}`;
 const first=await guest(firstName,'harefolk','scholar'),second=await guest(`Second ${suffix}`,'human','adventurer');await first.bringToFront();
 await first.waitForFunction(()=>window.mmoDebug.state.players.length===2,null,{polling:100});
 await first.keyboard.press('KeyF');await first.locator('[data-quest-offer="first_steps"]').click();await first.locator('[data-action="accept"]').click();
 await first.waitForFunction(()=>window.mmoDebug.state.self.quests.first_steps?.status==='active');await first.locator('#window-dialogue .window-close').click();
 for(const [key,id]of [['KeyB','bags'],['KeyC','character'],['KeyP','spellbook'],['KeyJ','journal'],['KeyM','map']]){await first.keyboard.press(key);await first.locator(`#window-${id}`).waitFor({state:'visible'});await first.locator(`#window-${id} .window-close`).click();}
 await first.locator('#main-menu-button').click();await first.locator('[data-page="options"]').click();const sound=first.locator('[data-setting="sound"]');await sound.setChecked(false);await first.keyboard.press('Escape');await first.keyboard.press('Escape');
 await first.keyboard.press('KeyH');await first.locator('[data-meadow-help]').waitFor();await first.locator('#window-help .window-close').click();
 const before=await first.evaluate(()=>window.mmoDebug.local.z);await first.keyboard.down('KeyW');await first.waitForTimeout(1200);await first.keyboard.up('KeyW');assert.ok((await first.evaluate(()=>window.mmoDebug.local.z))<before-3);
 await first.locator('#chat-input').fill('Hello from the shared client');await first.keyboard.press('Enter');await second.getByText('Hello from the shared client',{exact:true}).waitFor();
 assert.ok((await first.evaluate(()=>window.mmoDebug.render.calls))>0);assert.equal(await first.evaluate(()=>window.mmoDebug.environment.shaderErrors),0);
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});await first.screenshot({path:path.join(ROOT,'test-results/minimal-browser.png')});
 await first.locator('#main-menu-button').click();await first.locator('[data-logout]').click();await first.locator('#login').waitFor({state:'visible'});await first.locator('#join').click();await first.waitForFunction(()=>window.mmoDebug?.state?.self.quests.first_steps?.status==='active');
 const savedId=await first.evaluate(()=>window.mmoDebug.state.self.id);
 await first.locator('#main-menu-button').click();await first.locator('[data-logout]').click();await first.locator('#login').waitFor({state:'visible'});
 await first.evaluate(()=>{const key='minimal-account';localStorage.setItem(key,JSON.parse(localStorage.getItem(key)).token);});await first.reload();await first.locator('#join').click();await first.waitForFunction(()=>window.mmoDebug?.state?.self.quests.first_steps?.status==='active');assert.equal(await first.evaluate(()=>window.mmoDebug.state.self.id),savedId);
 const result={sharedClient:true,twoRaces:true,twoClasses:true,allRaceClassPreviews:true,customGameExtension:true,inventoryEquipmentSpellbookJournalAtlas:true,settings:true,twoPlayers:true,questAccepted:true,authoritativeMovement:true,chatDelivery:true,renderedScene:true,logoutResume:true,legacyAccountPreserved:true,errors:[...new Set(errors)]};assert.deepEqual(result.errors,[]);await writeFile(path.join(ROOT,'test-results/minimal-browser-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(error){console.error(JSON.stringify({errors:[...new Set(errors)],serverLog:server.logs},null,2));await mkdir(path.join(ROOT,'test-results'),{recursive:true});const page=contexts[0]?.pages()[0];if(page)await page.screenshot({path:path.join(ROOT,'test-results/minimal-browser-failure.png')}).catch(()=>{});throw error;}
finally{await Promise.all(contexts.map(c=>c.close()));if(browser)await browser.close();await server.stop();}
