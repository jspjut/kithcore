import {readFile,writeFile,cp,readdir,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import assert from 'node:assert/strict';
import {firefox} from '@playwright/test';
import {ROOT} from './worlds.js';
import {startTestWorld} from './testing.js';
const exec=promisify(execFile),sleep=(page,ms)=>page.waitForTimeout(ms);
async function ffmpeg(){
 if(process.env.FFMPEG_PATH)return process.env.FFMPEG_PATH;
 try{await exec('ffmpeg',['-version']);return 'ffmpeg';}catch{}
 let directory=path.dirname(firefox.executablePath());
 for(let i=0;i<5;i++,directory=path.dirname(directory)){
  let entries;try{entries=await readdir(directory);}catch{continue;}
  for(const name of entries.filter(n=>n.startsWith('ffmpeg-')))for(const filename of ['ffmpeg-linux','ffmpeg-mac','ffmpeg-win64.exe']){const binary=path.join(directory,name,filename);try{await access(binary,constants.X_OK);return binary;}catch{}}
 }
 throw Error('FFmpeg is needed to trim demo clips. Run npx playwright install firefox ffmpeg, or set FFMPEG_PATH.');
}
async function demoServer(world,kind){return startTestWorld(world,{setupRuntime:async runtime=>{
 await cp(path.join(ROOT,'tools/site-demo-fixture.js'),path.join(runtime.directory,'server/site-demo-fixture.js'));
 const file=path.join(runtime.directory,'server/index.js'),source=await readFile(file,'utf8'),marker='const connections = new Map()';if(!source.includes(marker))throw Error('Demo fixture insertion point changed');
 await writeFile(file,source.replace(marker,`const {installDemo}=await import('./site-demo-fixture.js');installDemo(world,${JSON.stringify(kind)});\n${marker}`));
}});}
async function recorded(browser,temporary,output,id,prepare,action){
 console.log(`Recording ${id} demo…`);
 const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:path.join(temporary,'raw-films'),size:{width:1280,height:800}}}),page=await context.newPage(),created=Date.now(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.demoEvidence=[];const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(...args){super(...args);this.addEventListener('message',event=>{let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.type==='social'&&msg.speech)window.demoEvidence.push({source:msg.source,emote:msg.emote,speech:msg.speech,cause:msg.cause});});}};});
 try{
  await prepare(page);await sleep(page,350);const start=Date.now(),evidence=await action(page);await sleep(page,450);const duration=(Date.now()-start)/1000,length=evidence.clipSeconds??duration;
  assert.deepEqual(errors,[],errors.join('\n'));const raw=page.video();await context.close();const source=await raw.path(),destination=path.join(output,'media',`${id}.webm`);
  await exec(await ffmpeg(),['-y','-ss',String(Math.max(0,(start-created)/1000-.08)),'-i',source,'-t',String(length),'-an','-c:v','libvpx','-b:v','1400k','-deadline','realtime','-cpu-used','4','-threads','2',destination],{maxBuffer:1024*1024});
  console.log(`Recorded ${id}: ${length.toFixed(1)} seconds, outcome verified.`);const {clipSeconds,...details}=evidence;return {id,seconds:Number(length.toFixed(2)),...details};
 }finally{await context.close();}
}
async function enter(page,base){
 await page.goto(base+'/?debug=1');await page.locator('#name').fill('Wayfarer');await page.locator('#join').click();await page.waitForFunction(()=>window.mmoDebug?.state?.self);await page.mouse.click(1100,620);await page.addStyleTag({content:'#location-announcement{display:none!important}'});await page.evaluate(async()=>{const {scene}=await import('/main.js');scene.zoom=11;scene.pitch=.42;});
}
export async function buildFilms({browser,world,base,output,temporary}){
 const films=[];let game;
 try{
  game=await startTestWorld(world);
  films.push(await recorded(browser,temporary,output,'character',async page=>{await page.goto(game.base+'/?debug=1');await page.locator('#name').fill('Wayfarer');await page.locator('#join').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#join').disabled);},async page=>{
   const initial=await page.evaluate(()=>({race:document.querySelector('#character-preview').dataset.raceId,class:document.querySelector('#character-preview').dataset.classId}));
   await page.locator('[data-class-choice]:not([disabled])').nth(1).click();await page.mouse.move(1100,80);await sleep(page,800);await page.locator('[data-race-choice]').nth(1).click();await page.mouse.move(1100,80);await sleep(page,800);await page.locator('[data-class-choice]:not([disabled])').last().click();await page.mouse.move(1100,80);await sleep(page,800);
   await page.locator('[data-look="dawn"]').click();await page.locator('#appearance-details').evaluate(el=>el.open=true);await page.locator('[data-appearance-field="skin"][data-value="bronze"]').click();await sleep(page,600);await page.locator('[data-appearance-field="hairStyle"]').selectOption('braid');await page.locator('[data-appearance-field="hairColor"][data-value="copper"]').click();await page.locator('[data-appearance-field="face"]').selectOption('angular');await page.locator('#preview-face').click();await sleep(page,1200);await page.locator('#preview-right').click();await sleep(page,900);
   await page.screenshot({path:path.join(output,'media/character.png')});const identity=await page.evaluate(()=>({race:document.querySelector('#character-preview').dataset.raceId,class:document.querySelector('#character-preview').dataset.classId,style:document.querySelector('[data-appearance-field="hairStyle"]').value}));assert.equal(identity.style,'braid');assert.notEqual(identity.race,initial.race);assert.notEqual(identity.class,initial.class);return {verified:identity,kind:'real character-creation UI'};
  }));await game.stop();game=null;
  films.push(await recorded(browser,temporary,output,'flyby',async page=>{await page.goto(base+'scene.html?flight=1');await page.waitForFunction(()=>window.scenePreview?.rendered);await page.addStyleTag({content:'#controls,#status{display:none}'});await page.screenshot({path:path.join(output,'media/flyby.png')});},async page=>{
   await page.evaluate(()=>window.scenePreview.startFlight());await sleep(page,14000);const info=await page.evaluate(()=>window.scenePreview);assert.ok(info.flightDistance>20);assert.equal(info.shaderErrors,0);return {clipSeconds:14,verified:{flightDistance:info.flightDistance},kind:'source renderer camera flight'};
  }));
  game=await demoServer(world,'combat');
  films.push(await recorded(browser,temporary,output,'combat',page=>enter(page,game.base),async page=>{
   const initial=await page.evaluate(()=>window.mmoDebug.state.self);await page.keyboard.down('KeyW');try{await page.waitForFunction(()=>{const s=window.mmoDebug.state,e=s.enemies.find(e=>e.id==='demo-mob');return e&&Math.hypot(e.x-s.self.x,e.z-s.self.z)<3.3;},null,{timeout:6000});}finally{await page.keyboard.up('KeyW');}
   await page.evaluate(async()=>{const {send}=await import('/main.js');send({type:'target',id:'demo-mob'});});await sleep(page,350);let poster=false;
   for(let i=0;i<50;i++){
    const info=await page.evaluate(async()=>{const s=window.mmoDebug.state;const {skillForRole}=await import('/shared/adventurers.js');const id=skillForRole(s.self,'primary');return {hp:s.enemies.find(e=>e.id==='demo-mob')?.hp,ready:(s.self.cooldowns[id]||0)<=s.time&&!s.self.casting&&(s.self.globalCooldown?.endsAt||0)<=s.time};});if(info.hp<=0)break;if(info.ready)await page.keyboard.press('Digit1');await sleep(page,500);if(!poster){await page.screenshot({path:path.join(output,'media/combat.png')});poster=true;}
   }
   await page.waitForFunction(()=>window.mmoDebug.state.enemies.find(e=>e.id==='demo-mob')?.hp===0);await page.evaluate(async()=>{const {send}=await import('/main.js');send({type:'interact',id:'demo-mob'});});await page.locator('[data-loot-all]').waitFor();await sleep(page,900);await page.locator('[data-loot-all]').click();await page.waitForFunction(gold=>window.mmoDebug.state.self.gold>gold,initial.gold);await sleep(page,1100);const final=await page.evaluate(()=>window.mmoDebug.state.self);assert.ok(final.hp>0&&final.gold>initial.gold);assert.ok(Object.keys(final.inventory).some(id=>final.inventory[id]>(initial.inventory[id]||0)));return {verified:{approached:true,defeated:true,looted:true,goldReceived:final.gold-initial.gold},kind:'staged encounter, real server combat and loot'};
  }));await game.stop();game=null;
  game=await demoServer(world,'social');
  films.push(await recorded(browser,temporary,output,'social',page=>enter(page,game.base),async page=>{
   await page.evaluate(async()=>{const {scene}=await import('/main.js');scene.zoom=13;scene.pitch=.36;});await sleep(page,5200);await page.screenshot({path:path.join(output,'media/social.png')});await sleep(page,6500);const exchanges=await page.evaluate(()=>window.demoEvidence.filter(e=>e.cause==='showcase-conversation'));assert.equal(exchanges.length,4);assert.equal(new Set(exchanges.map(e=>e.source)).size,2);return {verified:{speeches:exchanges.length,speakers:2,emotes:exchanges.map(e=>e.emote)},kind:'authored NPC exchange using real server social events'};
  }));await game.stop();game=null;
  await writeFile(path.join(output,'media/manifest.json'),JSON.stringify({films},null,2)+'\n');return films;
 }finally{await game?.stop();}
}
