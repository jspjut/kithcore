import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {firefox} from '@playwright/test';
import {startTestWorld} from './testing.js';
import {ROOT} from './worlds.js';
const selection=process.env.LIVE_TEST_WORLD||'minimal',server=await startTestWorld(selection),errors=[];let browser;
try{
 const worldId=server.runtime.manifest.id;
 const c=await import(pathToFileURL(path.join(server.runtime.directory,'shared/content.js')).href);
 const {CLASSES}=await import(pathToFileURL(path.join(server.runtime.directory,'shared/adventurers.js')).href);
 let patch=JSON.parse(await readFile(path.join(ROOT,'worlds/minimal/examples/live-update.json'),'utf8'));
 if(worldId!=='minimal'){
  const classId=Object.keys(CLASSES)[0],ability=CLASSES[classId].skills[0],enemy=Object.keys(c.ENEMY_TYPES)[0],npc=c.NPCS.find(n=>n.role==='quest'),merchant=c.NPCS.find(n=>n.role==='merchant');
  const places=[];for(let x=-2;x<=2;x+=2)for(let z=-2;z<=2;z+=2){const p={x:c.ZONE.spawn.x+x,z:c.ZONE.spawn.z+z};if(c.walkable(p.x,p.z))places.push(p);}assert.ok(places.length>=3);
  patch={...patch,id:'world-live-browser',worldId:server.runtime.manifest.id,abilities:{market_strike:{template:ability,values:{name:'Market Strike',description:'A newly added practice ability.',level:1,cost:0,damage:7,range:20}}},enemyTypes:{market_slime:{template:enemy,values:{name:'Market practice creature',hp:500,aggro:0}}},npcs:[{id:'market_guide',template:npc.id,...places[0],values:{name:'Market guide',title:'A new lesson'}},{id:'market_vendor',template:merchant.id,...places[1],values:{name:'Market vendor'}}],spawns:[{id:'market_practice',type:'market_slime',...places[2]}],quests:patch.quests.map(q=>({...q,classId})),dialogue:{market_guide:{greeting:'There is a new lesson today.'}},questText:{},merchantStock:[...c.MERCHANT_STOCK,'market_tonic']};
 }
 // Keep the live-ability check reachable while the practice creature roams during UI checks.
 patch.abilities.market_strike.values.range=20;
 async function submit(value){const file=path.join(server.data,'browser-update.json');await writeFile(file,JSON.stringify(value));const child=spawn(process.execPath,[path.join(ROOT,'tools/live-update.js'),'--data-dir',server.data,'--file',file],{stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);assert.equal((await once(child,'exit'))[0],0,output);}
 browser=await firefox.launch({headless:process.env.HEADED!=='1',firefoxUserPrefs:{'webgl.force-enabled':true,'gfx.webrender.software':true}});
 async function guest(name){const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(server.base+'/?debug=1');await page.locator('#name').fill(name);const classId=worldId==='minimal'?'adventurer':Object.keys(CLASSES)[0];await page.locator(`[data-class-choice="${classId}"]`).click();await page.mouse.move(1100,50);await page.locator('#name').focus();await page.keyboard.press('Escape');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);return page;}
 const first=await guest('Live Browser'),firstId=await first.evaluate(()=>window.mmoDebug.state.self.id);await submit(patch);
 await first.waitForFunction(()=>window.mmoDebug.contentRevision===1&&window.mmoDebug.units.some(u=>u.id==='market_guide')&&window.mmoDebug.units.some(u=>u.id==='live-mob-market_practice'));
 assert.equal(await first.evaluate(()=>window.mmoDebug.state.self.id),firstId);
 await first.evaluate(async()=>{const {ui}=await import('/main.js');ui.openDialogue('market_guide');});await first.locator('[data-quest-offer="market_lesson"]').waitFor();
 await submit({id:'market-followup',worldId:patch.worldId,dialogue:{market_guide:{greeting:'This greeting changed while your dialogue stayed open.',reply:'A new reply.'}},merchantStock:['market_tonic'],announcements:['The second live update is here.']});
 await first.getByText('This greeting changed while your dialogue stayed open.',{exact:true}).waitFor();await first.getByText('The second live update is here.',{exact:true}).waitFor();
 await first.locator('[data-quest-offer="market_lesson"]').click();await first.locator('[data-action="accept"]').click();await first.waitForFunction(()=>window.mmoDebug.state.self.quests.market_lesson?.status==='active');await first.locator('#window-dialogue .window-close').click();
 await first.evaluate(async()=>{const {ui}=await import('/main.js');ui.dialogueNPC='market_vendor';ui.openMerchant();});await first.locator('[data-buy="market_tonic"]').click();await first.waitForFunction(()=>window.mmoDebug.state.self.inventory.market_tonic===1);assert.equal(await first.locator('[data-buy]').count(),1);await submit({id:'market-stock-refresh',worldId:patch.worldId,merchantStock:['market_tonic','potion']});await first.locator('[data-buy="potion"]').waitFor();await first.locator('#window-merchant .window-close').click();
 await first.keyboard.press('KeyP');await first.locator('#book-search').fill('Market Strike');await first.getByText('Market Strike',{exact:true}).waitFor();await first.locator('#window-spellbook .window-close').click();
 await first.evaluate(async()=>{const {send}=await import('/main.js');send({type:'target',id:'live-mob-market_practice'});send({type:'skill',skill:'market_strike'});});await first.waitForFunction(()=>window.mmoDebug.state.self.quests.market_lesson.progress===1);
 const second=await guest('New Arrival');await second.waitForFunction(id=>window.mmoDebug.state.players.some(p=>p.id===id),firstId);assert.equal(await second.evaluate(()=>window.mmoDebug.contentRevision),3);await second.waitForFunction(()=>window.mmoDebug.units.some(u=>u.id==='live-mob-market_practice'));
 await first.bringToFront();await first.reload();await first.locator('#join').click();await first.waitForFunction(()=>window.mmoDebug?.state?.self.quests.market_lesson?.progress===1);assert.equal(await first.evaluate(()=>window.mmoDebug.contentRevision),3);
 assert.equal(await first.evaluate(()=>window.mmoDebug.environment.shaderErrors),0);assert.deepEqual(errors,[]);
 await mkdir(path.join(ROOT,'test-results'),{recursive:true});await first.screenshot({path:path.join(ROOT,`test-results/${worldId}-live-updates.png`)});
 console.log(JSON.stringify({world:worldId,existingPlayerStayedOnline:true,newNpcAndMobRendered:true,openDialogueRefreshed:true,vendorStockAndPurchase:true,newQuestAndAbility:true,announcement:true,newArrivalAndReload:true,errors},null,2));
}catch(error){console.error(server.logs);for(const page of browser?.contexts().flatMap(c=>c.pages())||[])console.error(JSON.stringify(await page.evaluate(()=>({self:window.mmoDebug?.state?.self,enemies:window.mmoDebug?.state?.enemies.filter(e=>e.id.startsWith('live-mob-')),toasts:document.querySelector('#toasts')?.textContent})).catch(()=>null)));throw error;}finally{await browser?.close();await server.stop();}
